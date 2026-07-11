import type { CloudSyncState, WorkspaceData } from '../shared/types';
import type { EncryptedStore } from './store';
import type { GitHubService } from './github';

const repoName = 'constellation-sync';
const filePath = 'workspace.json';
type RemoteFile = { content: string; sha: string };

export class CloudSyncService {
  private state: CloudSyncState = { enabled: false, syncing: false, lastSyncAt: null, repository: null };
  constructor(private store: EncryptedStore, private github: GitHubService) {}
  async initialize() { if (this.github.getAuth().status !== 'authorized') { this.state = { enabled: false, syncing: false, lastSyncAt: null, repository: null }; return; } const settings = await this.store.settings(); this.state = { enabled: false, syncing: false, lastSyncAt: settings.cloudSyncLastAt ?? null, repository: null }; }
  getState() { return this.state; }
  async autoSetup() {
    if (this.github.getAuth().status !== 'authorized') throw new Error('Connexion GitHub requise.');
    this.state = { ...this.state, syncing: true, error: undefined };
    try {
      await this.ensureRepository(); const remote = await this.getRemoteFile(); let workspace: WorkspaceData;
      if (remote) { workspace = mergeMachineLocal(parseWorkspace(remote.content), await this.store.workspace()); await this.store.write('workspace', workspace); }
      else { workspace = await this.store.workspace(); await this.putRemote(workspace); }
      return this.finish(workspace);
    } catch (error) { this.fail(error); throw error; }
  }
  async syncNow() {
    if (!this.state.enabled) return this.autoSetup();
    this.state = { ...this.state, syncing: true, error: undefined };
    try {
      const local = await this.store.workspace(); const remoteFile = await this.getRemoteFile(); let workspace = local;
      if (!remoteFile) await this.putRemote(local);
      else {
        const remote = parseWorkspace(remoteFile.content);
        if (new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()) { workspace = mergeMachineLocal(remote, local); await this.store.write('workspace', workspace); }
        else if (remote.updatedAt !== local.updatedAt) await this.putRemote(local, remoteFile.sha);
      }
      return this.finish(workspace);
    } catch (error) { this.fail(error); throw error; }
  }
  async disable() { return this.state; }
  private async finish(workspace: WorkspaceData) { const now = new Date().toISOString(); await this.store.updateSettings({ cloudSyncEnabled: true, cloudSyncLastAt: now }); this.state = { enabled: true, syncing: false, lastSyncAt: now, repository: repoName }; return { state: this.state, workspace }; }
  private fail(error: unknown) { this.state = { ...this.state, syncing: false, error: error instanceof Error ? error.message : 'Synchronisation impossible.' }; }
  private owner() { const login = this.github.getAuth().login; if (!login) throw new Error('Connexion GitHub requise.'); return login; }
  private async ensureRepository() { try { await this.github.apiRequest(`/repos/${this.owner()}/${repoName}`); } catch { await this.github.apiRequest('/user/repos', { method: 'POST', body: JSON.stringify({ name: repoName, description: 'Disposition Constellation synchronisée automatiquement', private: true, auto_init: true }) }); } }
  private async getRemoteFile(): Promise<RemoteFile | null> { try { const remote = await this.github.apiRequest<RemoteFile>(`/repos/${this.owner()}/${repoName}/contents/${filePath}`); return { ...remote, content: Buffer.from(remote.content.replace(/\s/g, ''), 'base64').toString('utf8') }; } catch (error) { if (error instanceof Error && error.message === 'Not Found') return null; throw error; } }
  private async putRemote(workspace: WorkspaceData, sha?: string) { await this.github.apiRequest(`/repos/${this.owner()}/${repoName}/contents/${filePath}`, { method: 'PUT', body: JSON.stringify({ message: 'Synchroniser automatiquement la disposition', content: Buffer.from(JSON.stringify(sanitized(workspace), null, 2)).toString('base64'), ...(sha ? { sha } : {}) }) }); }
}

function parseWorkspace(value: string) { const parsed = JSON.parse(value) as WorkspaceData; if (parsed.version !== 1 || !Array.isArray(parsed.folders) || typeof parsed.customizations !== 'object') throw new Error('Disposition distante invalide.'); return parsed; }
function sanitized(workspace: WorkspaceData): WorkspaceData { return { ...workspace, customizations: Object.fromEntries(Object.entries(workspace.customizations).map(([id, item]) => [id, { ...item, localPath: null }])) }; }
function mergeMachineLocal(remote: WorkspaceData, local: WorkspaceData): WorkspaceData { const customizations = Object.fromEntries(Object.entries(remote.customizations).map(([id, item]) => [id, { ...item, localPath: local.customizations[id]?.localPath ?? null }])); return { ...remote, customizations }; }
