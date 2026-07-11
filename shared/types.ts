export type ProjectStatus = 'idea' | 'active' | 'paused' | 'completed' | 'archived';
export type ViewMode = 'library' | 'kanban' | 'health';
export type CheckState = 'success' | 'failure' | 'pending' | 'unknown';

export interface GitHubRepo {
  nodeId: string; id: number; owner: string; name: string; fullName: string; description: string | null;
  url: string; homepage: string | null; visibility: 'public' | 'private' | 'internal'; archived: boolean;
  fork: boolean; language: string | null; topics: string[]; pushedAt: string | null; updatedAt: string;
  defaultBranch: string; openIssues: number; stars: number; license: string | null; organization: string | null;
  permissions: { admin: boolean; push: boolean; pull: boolean }; unavailable?: boolean;
}
export interface LocalRepoState { path: string; branch: string | null; dirty: boolean; ahead: number; behind: number; remote: string | null }
export interface RepoCustomization {
  repoNodeId: string; folderId: string | null; status: ProjectStatus; color: string | null; favorite: boolean;
  notes: string; manualTags: string[]; localPath: string | null; position: number; ignoredAlerts: string[];
}
export interface WorkspaceFolder { id: string; parentId: string | null; name: string; color: string; icon?: string; position: number }
export interface SavedCollection { id: string; name: string; query: RepoFilters; color: string }
export interface RepoFilters { status?: ProjectStatus; visibility?: string; organization?: string; language?: string; favorite?: boolean; localOnly?: boolean; health?: CheckState }
export interface WorkspaceData { version: 1; folders: WorkspaceFolder[]; customizations: Record<string, RepoCustomization>; collections: SavedCollection[]; updatedAt: string }
export interface SettingsData { version: 1; theme: 'dark' | 'light'; scanRoots: string[]; editorCommand: string; inactivityDays: number; lastSyncAt: string | null; cloudSyncEnabled?: boolean; cloudSyncLastAt?: string | null }
export interface AuthState { status: 'signed-out' | 'authorizing' | 'authorized' | 'denied' | 'expired' | 'revoked'; login?: string; avatarUrl?: string; verificationUri?: string; userCode?: string; error?: string }
export interface HealthAlert { id: string; severity: 'info' | 'warning' | 'error'; label: string; detail: string }
export interface RepoHealth { repoNodeId: string; lastPushAt: string | null; openIssues: number; openPullRequests: number; defaultBranchCheck: CheckState; alerts: HealthAlert[] }
export interface RepoContentEntry { name: string; path: string; type: 'file' | 'dir' | 'symlink' | 'submodule'; size: number; url: string }
export interface RepoIssueItem { number: number; title: string; author: string; labels: Array<{ name: string; color: string }>; updatedAt: string }
export interface RepoPullItem { number: number; title: string; author: string; draft: boolean; updatedAt: string; head: string; base: string }
export interface RepoWorkflowItem { id: number; name: string; status: string; conclusion: string | null; branch: string; createdAt: string }
export interface RepoDetails { readme: string | null; pullRequests: number; workflow: CheckState; local: LocalRepoState | null; contents: RepoContentEntry[]; latestCommit: { message: string; author: string; date: string; sha: string } | null; languages: Record<string, number>; issues: RepoIssueItem[]; pulls: RepoPullItem[]; workflows: RepoWorkflowItem[] }
export type WorkspaceCommand =
  | { type: 'create-folder'; folder: WorkspaceFolder }
  | { type: 'update-folder'; id: string; patch: Partial<Pick<WorkspaceFolder, 'name' | 'icon' | 'color'>> }
  | { type: 'rename-folder'; id: string; name: string }
  | { type: 'delete-folder'; id: string }
  | { type: 'update-repo'; repoNodeId: string; patch: Partial<Omit<RepoCustomization, 'repoNodeId'>> }
  | { type: 'create-collection'; collection: SavedCollection }
  | { type: 'delete-collection'; id: string };
export interface BackupResult { ok: boolean; path?: string; error?: string }
export interface ScanResult { matches: Record<string, LocalRepoState>; unmatched: LocalRepoState[] }
export interface CloudSyncState { enabled: boolean; syncing: boolean; lastSyncAt: string | null; repository: string | null; error?: string }
export interface UpdateState { phase: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'; currentVersion: string; version?: string; percent?: number; message?: string; error?: string }
export interface ConstellationApi {
  auth: { startDeviceFlow(): Promise<AuthState>; getState(): Promise<AuthState>; logout(): Promise<void> };
  repos: { sync(): Promise<GitHubRepo[]>; list(): Promise<GitHubRepo[]>; getDetails(nodeId: string): Promise<RepoDetails> };
  workspace: { load(): Promise<WorkspaceData>; applyCommand(command: WorkspaceCommand): Promise<WorkspaceData> };
  settings: { load(): Promise<SettingsData>; update(patch: Partial<SettingsData>): Promise<SettingsData> };
  local: { chooseRoots(): Promise<string[]>; scan(roots: string[]): Promise<ScanResult>; linkRepo(nodeId: string, path: string): Promise<WorkspaceData> };
  external: { openGitHub(nodeId: string): Promise<void>; openEditor(path: string): Promise<void>; openTerminal(path: string): Promise<void>; openExplorer(path: string): Promise<void> };
  githubWindow: { open(nodeId: string): Promise<void> };
  github: { updateMetadata(nodeId: string, patch: { description?: string; homepage?: string; topics?: string[] }): Promise<GitHubRepo>; archive(nodeId: string, archived?: boolean): Promise<GitHubRepo> };
  backup: { export(password: string): Promise<BackupResult>; import(mode: 'replace' | 'merge', password: string): Promise<BackupResult> };
  sync: { getState(): Promise<CloudSyncState>; setup(password: string): Promise<{ state: CloudSyncState; workspace: WorkspaceData }>; now(): Promise<{ state: CloudSyncState; workspace: WorkspaceData }>; disable(): Promise<CloudSyncState> };
  updater: { getState(): Promise<UpdateState>; check(): Promise<UpdateState>; install(): Promise<void>; onState(listener: (state: UpdateState) => void): () => void };
  app: { minimize(): Promise<void>; maximize(): Promise<void>; close(): Promise<void>; onSync(listener: (repos: GitHubRepo[]) => void): () => void };
}
