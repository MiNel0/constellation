import { contextBridge, ipcRenderer } from 'electron';
import type { ConstellationApi, GitHubRepo, UpdateState } from '../shared/types';

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;
const api: ConstellationApi = {
  auth: { startDeviceFlow: () => invoke('auth:start'), getState: () => invoke('auth:state'), logout: () => invoke('auth:logout') },
  repos: { sync: () => invoke('repos:sync'), list: () => invoke('repos:list'), getDetails: (id) => invoke('repos:details', id) },
  workspace: { load: () => invoke('workspace:load'), applyCommand: (command) => invoke('workspace:command', command) },
  settings: { load: () => invoke('settings:load'), update: (patch) => invoke('settings:update', patch) },
  local: { chooseRoots: () => invoke('local:choose'), scan: (roots) => invoke('local:scan', roots), linkRepo: (id, path) => invoke('local:link', id, path) },
  external: { openGitHub: (id) => invoke('external:github', id), openEditor: (path) => invoke('external:editor', path), openTerminal: (path) => invoke('external:terminal', path), openExplorer: (path) => invoke('external:explorer', path) },
  githubWindow: { open: (id) => invoke('github-window:open', id) },
  github: { updateMetadata: (id, patch) => invoke('github:update', id, patch), archive: (id, archived = true) => invoke('github:archive', id, archived) },
  backup: { export: (password) => invoke('backup:export', password), import: (mode, password) => invoke('backup:import', mode, password) },
  sync: { getState: () => invoke('sync:state'), setup: (password) => invoke('sync:setup', password), now: () => invoke('sync:now'), disable: () => invoke('sync:disable') },
  updater: { getState: () => invoke('update:state'), check: () => invoke('update:check'), install: () => invoke('update:install'), onState: (listener) => { const callback = (_event: Electron.IpcRendererEvent, state: UpdateState) => listener(state); ipcRenderer.on('update:state', callback); return () => ipcRenderer.removeListener('update:state', callback); } },
  app: { minimize: () => invoke('window:minimize'), maximize: () => invoke('window:maximize'), close: () => invoke('window:close'), onSync: (listener) => { const callback = (_event: Electron.IpcRendererEvent, repos: GitHubRepo[]) => listener(repos); ipcRenderer.on('repos:synced', callback); return () => ipcRenderer.removeListener('repos:synced', callback); } },
};
contextBridge.exposeInMainWorld('constellation', api);
