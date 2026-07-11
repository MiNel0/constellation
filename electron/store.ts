import { app, safeStorage } from 'electron';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GitHubRepo, SettingsData, WorkspaceCommand, WorkspaceData } from '../shared/types';

const defaults = {
  settings: (): SettingsData => ({ version: 1, theme: 'dark', scanRoots: [], editorCommand: 'code', inactivityDays: 90, lastSyncAt: null }),
  workspace: (): WorkspaceData => ({ version: 1, folders: [], customizations: {}, collections: [], updatedAt: new Date().toISOString() }),
  cache: (): GitHubRepo[] => [],
};

export class EncryptedStore {
  private base = join(app.getPath('userData'), 'data');
  private path(name: string) { return join(this.base, `${name}.enc`); }
  async read<T>(name: 'settings' | 'workspace' | 'cache' | 'credentials' | 'sync-credentials', fallback: T): Promise<T> {
    try {
      const encrypted = await readFile(this.path(name));
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Le chiffrement Windows est indisponible.');
      return JSON.parse(safeStorage.decryptString(encrypted)) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
      throw error;
    }
  }
  async write<T>(name: 'settings' | 'workspace' | 'cache' | 'credentials' | 'sync-credentials', value: T): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Le chiffrement Windows est indisponible.');
    const target = this.path(name); const temp = `${target}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(temp, safeStorage.encryptString(JSON.stringify(value)));
    await rename(temp, target);
  }
  settings() { return this.read('settings', defaults.settings()); }
  workspace() { return this.read('workspace', defaults.workspace()); }
  cache() { return this.read('cache', defaults.cache()); }
  async updateSettings(patch: Partial<SettingsData>) { const next = { ...(await this.settings()), ...patch, version: 1 as const }; await this.write('settings', next); return next; }
  async command(command: WorkspaceCommand): Promise<WorkspaceData> {
    const data = await this.workspace();
    switch (command.type) {
      case 'create-folder': data.folders.push(command.folder); break;
      case 'update-folder': data.folders = data.folders.map((f) => f.id === command.id ? { ...f, ...command.patch } : f); break;
      case 'rename-folder': data.folders = data.folders.map((f) => f.id === command.id ? { ...f, name: command.name } : f); break;
      case 'delete-folder': data.folders = data.folders.filter((f) => f.id !== command.id); Object.values(data.customizations).forEach((c) => { if (c.folderId === command.id) c.folderId = null; }); break;
      case 'update-repo': data.customizations[command.repoNodeId] = { ...defaultCustomization(command.repoNodeId), ...data.customizations[command.repoNodeId], ...command.patch }; break;
      case 'create-collection': data.collections.push(command.collection); break;
      case 'delete-collection': data.collections = data.collections.filter((c) => c.id !== command.id); break;
    }
    data.updatedAt = new Date().toISOString(); await this.write('workspace', data); return data;
  }
}

export function defaultCustomization(repoNodeId: string) {
  return { repoNodeId, folderId: null, status: 'idea' as const, color: null, favorite: false, notes: '', manualTags: [], localPath: null, position: 0, ignoredAlerts: [] };
}
