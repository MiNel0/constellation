import { app, BrowserWindow } from 'electron';
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater';
import type { UpdateState } from '../shared/types';

const { autoUpdater } = electronUpdater;

export class UpdateService {
  private state: UpdateState = { phase: 'idle', currentVersion: app.getVersion() };
  private interval: NodeJS.Timeout | null = null;

  constructor(private getWindow: () => BrowserWindow | null) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('checking-for-update', () => this.set({ phase: 'checking' }));
    autoUpdater.on('update-available', (info: UpdateInfo) => this.set({ phase: 'available', version: info.version }));
    autoUpdater.on('update-not-available', () => this.set({ phase: 'up-to-date', version: app.getVersion() }));
    autoUpdater.on('download-progress', (progress: ProgressInfo) => this.set({ phase: 'downloading', percent: Math.round(progress.percent) }));
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => this.set({ phase: 'ready', version: info.version, percent: 100 }));
    autoUpdater.on('error', (error: Error) => this.set({ phase: 'error', error: this.friendlyError(error) }));
  }

  start() {
    if (!app.isPackaged) return;
    setTimeout(() => void this.check(false), 20_000);
    this.interval = setInterval(() => void this.check(false), 4 * 60 * 60_000);
  }

  stop() { if (this.interval) clearInterval(this.interval); }
  getState() { return this.state; }

  async check(manual = true) {
    if (!app.isPackaged) {
      this.set({ phase: 'up-to-date', version: app.getVersion(), message: 'Les mises à jour sont vérifiées dans la version installée.' });
      return this.state;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.set({ phase: 'error', error: this.friendlyError(error), message: manual ? 'Vérification impossible pour le moment.' : undefined });
    }
    return this.state;
  }

  install() { if (this.state.phase === 'ready') autoUpdater.quitAndInstall(false, true); }

  private set(patch: Partial<UpdateState>) {
    this.state = { ...this.state, ...patch, currentVersion: app.getVersion() };
    this.getWindow()?.webContents.send('update:state', this.state);
  }

  private friendlyError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/404|latest\.yml|release/i.test(message)) return 'Aucune release de mise à jour n’est encore publiée.';
    if (/net|ENOTFOUND|internet|offline/i.test(message)) return 'Connexion au service de mise à jour impossible.';
    return 'La mise à jour sera retentée automatiquement.';
  }
}
