import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitHubRepo, LocalRepoState, ScanResult } from '../shared/types';
const exec = promisify(execFile);

export function normalizeGitHubRemote(remote: string | null): string | null {
  if (!remote) return null;
  const match = remote.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
}
async function git(cwd: string, args: string[]) { try { return (await exec('git', ['-C', cwd, ...args], { windowsHide: true })).stdout.trim(); } catch { return ''; } }
async function inspect(path: string): Promise<LocalRepoState> {
  const remote = await git(path, ['remote', 'get-url', 'origin']); const branch = await git(path, ['branch', '--show-current']); const porcelain = await git(path, ['status', '--porcelain']);
  const counts = await git(path, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']); const [behind = '0', ahead = '0'] = counts.split(/\s+/);
  return { path, branch: branch || null, dirty: Boolean(porcelain), ahead: Number(ahead), behind: Number(behind), remote: remote || null };
}
async function findRepos(root: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    if (entries.some((entry) => entry.name === '.git')) return [root];
    const nested = entries.filter((entry) => entry.isDirectory() && !['node_modules', '.cache', 'AppData', '$Recycle.Bin'].includes(entry.name));
    return (await Promise.all(nested.map((entry) => findRepos(join(root, entry.name), depth + 1)))).flat();
  } catch { return []; }
}
export async function scanLocal(roots: string[], repos: GitHubRepo[]): Promise<ScanResult> {
  const paths = [...new Set((await Promise.all(roots.map((root) => findRepos(resolve(root))))).flat())]; const states = await Promise.all(paths.map(inspect)); const matches: Record<string, LocalRepoState> = {}; const unmatched: LocalRepoState[] = [];
  for (const state of states) { const key = normalizeGitHubRemote(state.remote); const repo = repos.find((item) => item.fullName.toLowerCase() === key); if (repo) matches[repo.nodeId] = state; else unmatched.push(state); }
  return { matches, unmatched };
}
export async function validDirectory(path: string) { try { return (await stat(path)).isDirectory(); } catch { return false; } }
