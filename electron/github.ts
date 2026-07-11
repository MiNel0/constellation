import { shell } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AccountSummary, AuthState, CheckState, GitHubRepo, RepoContentEntry, RepoDetails } from '../shared/types';
import type { EncryptedStore } from './store';

const api = 'https://api.github.com';
declare const __CONSTELLATION_GITHUB_CLIENT_ID__: string;
const clientId = process.env.CONSTELLATION_GITHUB_CLIENT_ID || __CONSTELLATION_GITHUB_CLIENT_ID__;
const exec = promisify(execFile);
type Credentials = { token: string };
type StoredAccount = { login: string; avatarUrl: string; token: string };
type AccountRegistry = { version: 1; activeLogin: string | null; accounts: StoredAccount[] };

export class GitHubService {
  private auth: AuthState = { status: 'signed-out' };
  private repos: GitHubRepo[] = [];
  private registry: AccountRegistry = { version: 1, activeLogin: null, accounts: [] };
  constructor(private store: EncryptedStore) {}
  async initialize() {
    this.registry = await this.store.readGlobal('accounts', this.registry);
    if (!this.registry.accounts.length) {
      const legacy = await this.store.read<Credentials | null>('credentials', null);
      if (legacy) try { const user = await this.request<{ login: string; avatar_url: string }>('/user', {}, legacy.token); this.registry = { version: 1, activeLogin: user.login, accounts: [{ login: user.login, avatarUrl: user.avatar_url, token: legacy.token }] }; await this.store.writeGlobal('accounts', this.registry); await this.store.migrateLegacyProfile(user.login); } catch { this.auth = { status: 'revoked' }; return; }
    }
    if (this.registry.activeLogin) await this.activate(this.registry.activeLogin);
  }
  getAuth() { return this.auth; }
  getAccounts(): AccountSummary[] { return this.registry.accounts.map((account) => ({ login: account.login, avatarUrl: account.avatarUrl, active: account.login === this.registry.activeLogin })); }
  async switchAccount(login: string) { if (!this.registry.accounts.some((account) => account.login.toLowerCase() === login.toLowerCase())) throw new Error('Compte GitHub inconnu.'); await this.activate(login); await this.store.writeGlobal('accounts', this.registry); return this.auth; }
  async logout() { const login = this.registry.activeLogin; this.registry.accounts = this.registry.accounts.filter((account) => account.login !== login); this.registry.activeLogin = this.registry.accounts[0]?.login ?? null; await this.store.writeGlobal('accounts', this.registry); if (this.registry.activeLogin) await this.activate(this.registry.activeLogin); else { this.store.setActiveProfile(null); this.repos = []; this.auth = { status: 'signed-out' }; } }
  async startDeviceFlow(): Promise<AuthState> {
    if (!clientId) return this.connectWithGitHubCli();
    const response = await fetch('https://github.com/login/device/code', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, scope: 'repo read:org' }) });
    if (!response.ok) throw new Error('Impossible de démarrer la connexion GitHub.');
    const device = await response.json() as { device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number };
    this.auth = { status: 'authorizing', userCode: device.user_code, verificationUri: device.verification_uri }; await shell.openExternal(device.verification_uri);
    const deadline = Date.now() + device.expires_in * 1000; let interval = device.interval * 1000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, device_code: device.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }) });
      const result = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };
      if (result.error === 'authorization_pending') continue;
      if (result.error === 'slow_down') { interval += 5000; continue; }
      if (result.error) return this.auth = { status: result.error === 'expired_token' ? 'expired' : 'denied', error: result.error_description };
      if (result.access_token) {
        const user = await this.request<{ login: string; avatar_url: string }>('/user', {}, result.access_token);
        return this.addAccount(result.access_token, user.login, user.avatar_url);
      }
    }
    return this.auth = { status: 'expired' };
  }
  private async connectWithGitHubCli(): Promise<AuthState> {
    try {
      this.auth = { status: 'authorizing' };
      const { stdout } = await exec('gh', ['auth', 'token'], { windowsHide: true });
      const token = stdout.trim();
      if (!token) throw new Error('Aucun token GitHub CLI disponible.');
      const user = await this.request<{ login: string; avatar_url: string }>('/user', {}, token);
      return this.addAccount(token, user.login, user.avatar_url);
    } catch {
      return this.auth = { status: 'denied', error: 'Connecte GitHub CLI avec « gh auth login », puis réessaie.' };
    }
  }
  list() { return this.repos; }
  find(nodeId: string) { const repo = this.repos.find((item) => item.nodeId === nodeId); if (!repo) throw new Error('Dépôt introuvable.'); return repo; }
  apiRequest<T>(path: string, init: RequestInit = {}) { return this.request<T>(path, init); }
  async sync() {
    const incoming = await this.paginate<Record<string, unknown>>('/user/repos?affiliation=owner,collaborator,organization_member&visibility=all&sort=updated&per_page=100');
    const previous = new Map(this.repos.map((repo) => [repo.nodeId, repo]));
    this.repos = incoming.map(mapRepo);
    for (const [nodeId, repo] of previous) if (!this.repos.some((item) => item.nodeId === nodeId)) this.repos.push({ ...repo, unavailable: true });
    await this.store.write('cache', this.repos); await this.store.updateSettings({ lastSyncAt: new Date().toISOString() }); return this.repos;
  }
  async details(nodeId: string): Promise<RepoDetails> {
    const repo = this.find(nodeId); let readme: string | null = null; let workflow: CheckState = 'unknown'; let contents: RepoContentEntry[] = []; let latestCommit: RepoDetails['latestCommit'] = null; let languages: Record<string, number> = {}; let issues: RepoDetails['issues'] = []; let pulls: RepoDetails['pulls'] = []; let workflows: RepoDetails['workflows'] = [];
    try { const value = await this.request<{ content: string; encoding: string }>(`/repos/${repo.fullName}/readme`); readme = value.encoding === 'base64' ? Buffer.from(value.content, 'base64').toString('utf8') : null; } catch { /* optional */ }
    try { const runs = await this.request<{ workflow_runs: Array<{ id: number; name: string; conclusion: string | null; status: string; head_branch: string; created_at: string }> }>(`/repos/${repo.fullName}/actions/runs?per_page=30`); const run = runs.workflow_runs[0]; workflow = !run ? 'unknown' : run.status !== 'completed' ? 'pending' : run.conclusion === 'success' ? 'success' : 'failure'; workflows = runs.workflow_runs.map((item) => ({ id: item.id, name: item.name, status: item.status, conclusion: item.conclusion, branch: item.head_branch, createdAt: item.created_at })); } catch { /* optional */ }
    try { contents = await this.request<RepoContentEntry[]>(`/repos/${repo.fullName}/contents/?ref=${encodeURIComponent(repo.defaultBranch)}`); contents.sort((a, b) => Number(b.type === 'dir') - Number(a.type === 'dir') || a.name.localeCompare(b.name)); } catch { /* optional */ }
    try { const commits = await this.request<Array<{ sha: string; commit: { message: string; author: { name: string; date: string } }; author?: { login: string } }>>(`/repos/${repo.fullName}/commits?sha=${encodeURIComponent(repo.defaultBranch)}&per_page=1`); const commit = commits[0]; if (commit) latestCommit = { message: commit.commit.message.split('\n')[0], author: commit.author?.login ?? commit.commit.author.name, date: commit.commit.author.date, sha: commit.sha.slice(0, 7) }; } catch { /* optional */ }
    try { languages = await this.request<Record<string, number>>(`/repos/${repo.fullName}/languages`); } catch { /* optional */ }
    try { const raw = await this.request<Array<{ number: number; title: string; user: { login: string }; labels: Array<{ name: string; color: string }>; updated_at: string; pull_request?: unknown }>>(`/repos/${repo.fullName}/issues?state=open&per_page=50`); issues = raw.filter((item) => !item.pull_request).map((item) => ({ number: item.number, title: item.title, author: item.user.login, labels: item.labels, updatedAt: item.updated_at })); } catch { /* optional */ }
    try { const raw = await this.request<Array<{ number: number; title: string; user: { login: string }; draft: boolean; updated_at: string; head: { ref: string }; base: { ref: string } }>>(`/repos/${repo.fullName}/pulls?state=open&per_page=50`); pulls = raw.map((item) => ({ number: item.number, title: item.title, author: item.user.login, draft: item.draft, updatedAt: item.updated_at, head: item.head.ref, base: item.base.ref })); } catch { /* optional */ }
    return { readme, workflow, pullRequests: pulls.length, local: null, contents, latestCommit, languages, issues, pulls, workflows };
  }
  async update(nodeId: string, patch: { description?: string; homepage?: string; topics?: string[]; archived?: boolean }) {
    const repo = this.find(nodeId); const { topics, ...metadata } = patch;
    if (Object.keys(metadata).length) await this.request(`/repos/${repo.fullName}`, { method: 'PATCH', body: JSON.stringify(metadata) });
    if (topics) await this.request(`/repos/${repo.fullName}/topics`, { method: 'PUT', body: JSON.stringify({ names: topics }) });
    const fresh = mapRepo(await this.request<Record<string, unknown>>(`/repos/${repo.fullName}`)); this.repos = this.repos.map((r) => r.nodeId === nodeId ? fresh : r); await this.store.write('cache', this.repos); return fresh;
  }
  private async addAccount(token: string, login: string, avatarUrl: string) {
    const firstAccount = this.registry.accounts.length === 0; const account = { login, avatarUrl, token }; const index = this.registry.accounts.findIndex((item) => item.login.toLowerCase() === login.toLowerCase());
    if (index >= 0) this.registry.accounts[index] = account; else this.registry.accounts.push(account);
    this.registry.activeLogin = login; await this.store.writeGlobal('accounts', this.registry); if (firstAccount) await this.store.migrateLegacyProfile(login); await this.activate(login); return this.auth;
  }
  private async activate(login: string) {
    const account = this.registry.accounts.find((item) => item.login.toLowerCase() === login.toLowerCase()); if (!account) throw new Error('Compte GitHub inconnu.');
    this.registry.activeLogin = account.login; this.store.setActiveProfile(account.login); this.repos = await this.store.cache();
    try { const user = await this.request<{ login: string; avatar_url: string }>('/user', {}, account.token); account.avatarUrl = user.avatar_url; this.auth = { status: 'authorized', login: account.login, avatarUrl: account.avatarUrl }; }
    catch { this.auth = { status: 'revoked', login: account.login, avatarUrl: account.avatarUrl }; }
  }
  private async paginate<T>(path: string): Promise<T[]> { const all: T[] = []; for (let page = 1; ; page++) { const joiner = path.includes('?') ? '&' : '?'; const batch = await this.request<T[]>(`${path}${joiner}page=${page}`); all.push(...batch); if (batch.length < 100) return all; } }
  private async request<T>(path: string, init: RequestInit = {}, explicitToken?: string): Promise<T> {
    const token = explicitToken ?? this.registry.accounts.find((account) => account.login === this.registry.activeLogin)?.token;
    if (!token) throw new Error('Connexion GitHub requise.');
    const response = await fetch(`${api}${path}`, { ...init, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers ?? {}) } });
    if (response.status === 401) this.auth = { status: 'revoked' };
    if (!response.ok) { const body = await response.json().catch(() => ({})) as { message?: string }; throw new Error(body.message ?? `GitHub HTTP ${response.status}`); }
    return response.json() as Promise<T>;
  }
}

function mapRepo(raw: Record<string, unknown>): GitHubRepo {
  const owner = raw.owner as { login: string; type: string }; const permissions = (raw.permissions ?? {}) as Record<string, boolean>;
  return { nodeId: String(raw.node_id), id: Number(raw.id), owner: owner.login, name: String(raw.name), fullName: String(raw.full_name), description: raw.description ? String(raw.description) : null, url: String(raw.html_url), homepage: raw.homepage ? String(raw.homepage) : null, visibility: String(raw.visibility ?? (raw.private ? 'private' : 'public')) as GitHubRepo['visibility'], archived: Boolean(raw.archived), fork: Boolean(raw.fork), language: raw.language ? String(raw.language) : null, topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [], pushedAt: raw.pushed_at ? String(raw.pushed_at) : null, updatedAt: String(raw.updated_at), defaultBranch: String(raw.default_branch ?? 'main'), openIssues: Number(raw.open_issues_count ?? 0), stars: Number(raw.stargazers_count ?? 0), license: (raw.license as { spdx_id?: string } | null)?.spdx_id ?? null, organization: owner.type === 'Organization' ? owner.login : null, permissions: { admin: Boolean(permissions.admin), push: Boolean(permissions.push), pull: permissions.pull !== false } };
}
