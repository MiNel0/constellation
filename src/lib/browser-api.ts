import type { ConstellationApi, GitHubRepo, SettingsData, WorkspaceCommand, WorkspaceData } from '../../shared/types';

const demoRepos: GitHubRepo[] = [
  { nodeId: 'demo-vigie', id: 1, owner: 'MiNel0', name: 'vigie', fullName: 'MiNel0/vigie', description: "Widget Windows de monitoring d'espace disque VPS", url: 'https://github.com/MiNel0/vigie', homepage: null, visibility: 'private', archived: false, fork: false, language: 'JavaScript', topics: ['electron', 'react', 'monitoring'], pushedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), defaultBranch: 'main', openIssues: 2, stars: 0, license: 'MIT', organization: null, permissions: { admin: true, push: true, pull: true } },
  { nodeId: 'demo-constellation', id: 2, owner: 'MiNel0', name: 'constellation', fullName: 'MiNel0/constellation', description: 'Bureau visuel local-first pour organiser ses dépôts GitHub', url: 'https://github.com/MiNel0/constellation', homepage: null, visibility: 'private', archived: false, fork: false, language: 'TypeScript', topics: ['electron', 'github'], pushedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), defaultBranch: 'main', openIssues: 0, stars: 0, license: 'MIT', organization: null, permissions: { admin: true, push: true, pull: true } },
  { nodeId: 'demo-lab', id: 3, owner: 'MiNel0', name: 'vibe-lab', fullName: 'MiNel0/vibe-lab', description: null, url: 'https://github.com/MiNel0/vibe-lab', homepage: null, visibility: 'public', archived: false, fork: false, language: 'Python', topics: [], pushedAt: '2025-10-01T10:00:00Z', updatedAt: '2025-10-01T10:00:00Z', defaultBranch: 'main', openIssues: 1, stars: 3, license: null, organization: null, permissions: { admin: true, push: true, pull: true } },
];
const defaultWorkspace: WorkspaceData = { version: 1, folders: [{ id: 'apps', parentId: null, name: 'Applications', color: '#7aa2f7', position: 0 }], customizations: { 'demo-vigie': { repoNodeId: 'demo-vigie', folderId: 'apps', status: 'active', color: null, favorite: true, notes: 'Projet de référence', manualTags: ['windows'], localPath: null, position: 0, ignoredAlerts: [] }, 'demo-constellation': { repoNodeId: 'demo-constellation', folderId: 'apps', status: 'active', color: null, favorite: true, notes: '', manualTags: [], localPath: null, position: 1, ignoredAlerts: [] } }, collections: [], updatedAt: new Date().toISOString() };
const defaultSettings: SettingsData = { version: 1, theme: 'dark', scanRoots: [], editorCommand: 'code', inactivityDays: 90, lastSyncAt: new Date().toISOString() };

export function createBrowserApi(): ConstellationApi {
  let workspace = readWorkspace(); let settings = defaultSettings;
  const persist = () => localStorage.setItem('constellation-demo-workspace', JSON.stringify(workspace));
  return {
    auth: { getState: async () => ({ status: 'authorized', login: 'mode-demo' }), startDeviceFlow: async () => ({ status: 'denied', error: 'La connexion GitHub réelle est disponible dans la fenêtre Electron.' }), logout: async () => undefined },
    repos: { list: async () => demoRepos, sync: async () => demoRepos, getDetails: async () => ({ readme: '# Mode démonstration\n\nOuvrez Constellation dans Electron pour charger les données GitHub réelles.', pullRequests: 0, workflow: 'success', local: null, contents: [{ name: 'src', path: 'src', type: 'dir', size: 0, url: '' }, { name: 'README.md', path: 'README.md', type: 'file', size: 1200, url: '' }, { name: 'package.json', path: 'package.json', type: 'file', size: 800, url: '' }], latestCommit: { message: 'Initialisation du projet', author: 'MiNel0', date: new Date().toISOString(), sha: 'a1b2c3d' }, languages: { TypeScript: 92000, CSS: 8000 }, issues: [], pulls: [], workflows: [] }) },
    workspace: { load: async () => workspace, applyCommand: async (command) => { workspace = apply(workspace, command); persist(); return workspace; } },
    settings: { load: async () => settings, update: async (patch) => settings = { ...settings, ...patch } },
    local: { chooseRoots: async () => [], scan: async () => ({ matches: {}, unmatched: [] }), linkRepo: async () => workspace },
    external: { openGitHub: async (id) => { const repo = demoRepos.find((item) => item.nodeId === id); if (repo) open(repo.url, '_blank', 'noopener'); }, openEditor: async () => undefined, openTerminal: async () => undefined, openExplorer: async () => undefined },
    githubWindow: { open: async (id) => { const repo = demoRepos.find((item) => item.nodeId === id); if (repo) open(repo.url, '_blank', 'noopener'); } },
    github: { updateMetadata: async (id) => demoRepos.find((item) => item.nodeId === id)!, archive: async (id) => demoRepos.find((item) => item.nodeId === id)! },
    backup: { export: async () => ({ ok: false, error: 'Disponible dans Electron' }), import: async () => ({ ok: false, error: 'Disponible dans Electron' }) },
    sync: { getState: async () => ({ enabled: false, syncing: false, lastSyncAt: null, repository: null }), setup: async () => ({ state: { enabled: false, syncing: false, lastSyncAt: null, repository: null }, workspace }), now: async () => ({ state: { enabled: false, syncing: false, lastSyncAt: null, repository: null }, workspace }), disable: async () => ({ enabled: false, syncing: false, lastSyncAt: null, repository: null }) },
    updater: { getState: async () => ({ phase: 'up-to-date', currentVersion: '1.0.0' }), check: async () => ({ phase: 'up-to-date', currentVersion: '1.0.0' }), install: async () => undefined, onState: () => () => undefined },
    app: { minimize: async () => undefined, maximize: async () => undefined, close: async () => undefined, onSync: () => () => undefined },
  };
}

function readWorkspace() { try { return JSON.parse(localStorage.getItem('constellation-demo-workspace') ?? '') as WorkspaceData; } catch { return structuredClone(defaultWorkspace); } }
function apply(data: WorkspaceData, command: WorkspaceCommand): WorkspaceData {
  const next = structuredClone(data);
  if (command.type === 'create-folder') next.folders.push(command.folder);
  if (command.type === 'update-folder') next.folders = next.folders.map((folder) => folder.id === command.id ? { ...folder, ...command.patch } : folder);
  if (command.type === 'rename-folder') next.folders = next.folders.map((folder) => folder.id === command.id ? { ...folder, name: command.name } : folder);
  if (command.type === 'delete-folder') next.folders = next.folders.filter((folder) => folder.id !== command.id);
  if (command.type === 'update-repo') {
    const existing = next.customizations[command.repoNodeId];
    next.customizations[command.repoNodeId] = { ...(existing ?? { repoNodeId: command.repoNodeId, folderId: null, status: 'idea', color: null, favorite: false, notes: '', manualTags: [], localPath: null, position: 0, ignoredAlerts: [] }), ...command.patch, repoNodeId: command.repoNodeId };
  }
  if (command.type === 'create-collection') next.collections.push(command.collection);
  if (command.type === 'delete-collection') next.collections = next.collections.filter((item) => item.id !== command.id);
  next.updatedAt = new Date().toISOString(); return next;
}
