import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { EncryptedStore } from './store';
import { GitHubService } from './github';
import { scanLocal, validDirectory } from './local';
import { exportBackup, importBackup } from './backup';
import { CloudSyncService } from './cloud-sync';
import { UpdateService } from './updater';
import type { SettingsData, WorkspaceCommand } from '../shared/types';

const __dirname = join(fileURLToPath(new URL('.', import.meta.url)));
let win: BrowserWindow | null = null; const store = new EncryptedStore(); const github = new GitHubService(store); const cloudSync = new CloudSyncService(store, github);
const updates = new UpdateService(() => win);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
const idSchema = z.string().min(1).max(200); const pathSchema = z.string().min(1).max(32_000);
const commandSchema = z.object({ type: z.enum(['create-folder', 'update-folder', 'rename-folder', 'delete-folder', 'update-repo', 'create-collection', 'delete-collection']) }).passthrough();
function handle(channel: string, callback: (...args: unknown[]) => unknown) { ipcMain.handle(channel, (_event, ...args) => callback(...args)); }

async function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1050, minHeight: 650, frame: false, icon: join(app.getAppPath(), 'build', 'icon.ico'), backgroundColor: '#090b13', show: false, webPreferences: { preload: join(__dirname, 'preload.mjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://github.com/')) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (url !== win?.webContents.getURL()) event.preventDefault(); });
  if (process.env.VITE_DEV_SERVER_URL) await win.loadURL(process.env.VITE_DEV_SERVER_URL); else await win.loadFile(join(__dirname, '../dist/index.html'));
  win.show();
  win.focus();
}

app.whenReady().then(async () => { app.setAppUserModelId('dev.minelo.constellation'); await github.initialize(); await cloudSync.initialize(); if (github.getAuth().status === 'authorized') await cloudSync.autoSetup().catch(() => undefined); await createWindow(); updates.start(); setInterval(() => { if (github.getAuth().status === 'authorized') { void github.sync().then((repos) => win?.webContents.send('repos:synced', repos)).catch(() => undefined); void cloudSync.syncNow().catch(() => undefined); } }, 15 * 60_000); });
app.on('before-quit', () => updates.stop());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow(); });

handle('auth:start', async () => { const state = await github.startDeviceFlow(); if (state.status === 'authorized') { await cloudSync.initialize(); await cloudSync.autoSetup(); const repos = await github.sync(); win?.webContents.send('repos:synced', repos); } return state; });
handle('auth:state', () => github.getAuth()); handle('auth:accounts', () => github.getAccounts());
handle('auth:switch', async (rawLogin) => { const state = await github.switchAccount(z.string().min(1).max(100).parse(rawLogin)); await cloudSync.initialize(); await cloudSync.autoSetup().catch(() => undefined); const repos = await github.sync().catch(() => github.list()); win?.webContents.send('repos:synced', repos); return state; });
handle('auth:logout', async () => { await github.logout(); await cloudSync.initialize(); win?.webContents.send('repos:synced', github.list()); });
handle('repos:list', () => github.list()); handle('repos:sync', () => github.sync()); handle('repos:details', (id) => github.details(idSchema.parse(id)));
handle('workspace:load', () => store.workspace()); handle('workspace:command', (command) => store.command(commandSchema.parse(command) as WorkspaceCommand));
handle('settings:load', () => store.settings()); handle('settings:update', (patch) => store.updateSettings(z.record(z.unknown()).parse(patch) as Partial<SettingsData>));
handle('update:state', () => updates.getState()); handle('update:check', () => updates.check()); handle('update:install', () => updates.install());
handle('local:choose', async () => (await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'multiSelections'] })).filePaths);
handle('local:scan', async (roots) => scanLocal(z.array(pathSchema).parse(roots), github.list()));
handle('local:link', async (id, path) => { idSchema.parse(id); pathSchema.parse(path); if (!(await validDirectory(String(path)))) throw new Error('Ce dossier est introuvable.'); return store.command({ type: 'update-repo', repoNodeId: String(id), patch: { localPath: String(path) } }); });
handle('external:github', (id) => shell.openExternal(github.find(idSchema.parse(id)).url));
handle('github-window:open', (id) => {
  const repo = github.find(idSchema.parse(id));
  const popup = new BrowserWindow({ width: 1380, height: 900, minWidth: 900, minHeight: 600, title: `${repo.fullName} — GitHub`, backgroundColor: '#0d1117', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  popup.webContents.setWindowOpenHandler(({ url }) => url.startsWith('https://github.com/') ? { action: 'allow' } : { action: 'deny' });
  popup.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('https://github.com/')) event.preventDefault(); });
  void popup.loadURL(repo.url);
});
handle('external:editor', async (path) => { pathSchema.parse(path); if (!(await validDirectory(String(path)))) throw new Error('Dossier local introuvable.'); spawn('code', [String(path)], { detached: true, windowsHide: true }).unref(); });
handle('external:terminal', async (path) => { pathSchema.parse(path); if (!(await validDirectory(String(path)))) throw new Error('Dossier local introuvable.'); spawn('powershell.exe', ['-NoExit', '-Command', `Set-Location -LiteralPath '${String(path).replaceAll("'", "''")}'`], { detached: true }).unref(); });
handle('external:explorer', (path) => shell.openPath(pathSchema.parse(path)));
handle('github:update', (id, patch) => github.update(idSchema.parse(id), z.object({ description: z.string().max(350).optional(), homepage: z.string().max(500).optional(), topics: z.array(z.string().max(50)).max(20).optional() }).parse(patch)));
handle('github:archive', (id, archived) => github.update(idSchema.parse(id), { archived: z.boolean().parse(archived) }));
handle('backup:export', async (rawPassword) => { const password = z.string().min(8).max(200).parse(rawPassword); const result = await dialog.showSaveDialog(win!, { defaultPath: 'constellation-backup.constellation', filters: [{ name: 'Sauvegarde Constellation', extensions: ['constellation'] }] }); if (result.canceled || !result.filePath) return { ok: false }; await exportBackup(result.filePath, password, { version: 1, workspace: await store.workspace(), settings: await store.settings() }); return { ok: true, path: result.filePath }; });
handle('backup:import', async (rawMode, rawPassword) => { const mode = z.enum(['replace', 'merge']).parse(rawMode); const password = z.string().min(8).max(200).parse(rawPassword); const result = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'Sauvegarde Constellation', extensions: ['constellation'] }] }); if (result.canceled) return { ok: false }; const data = await importBackup(result.filePaths[0], password); if (mode === 'merge') { const current = await store.workspace(); data.workspace = { ...data.workspace, folders: [...current.folders, ...data.workspace.folders.filter((f) => !current.folders.some((x) => x.id === f.id))], customizations: { ...current.customizations, ...data.workspace.customizations } }; } await store.write('workspace', data.workspace); await store.write('settings', data.settings); return { ok: true, path: result.filePaths[0] }; });
handle('sync:state', () => cloudSync.getState());
handle('sync:setup', () => cloudSync.autoSetup());
handle('sync:now', () => cloudSync.syncNow());
handle('sync:disable', () => cloudSync.disable());
handle('window:minimize', () => win?.minimize()); handle('window:maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize()); handle('window:close', () => win?.close());
