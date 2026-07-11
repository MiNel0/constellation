import { describe, expect, it } from 'vitest';
import { healthAlerts } from './health';
import type { GitHubRepo } from '../../shared/types';
const repo: GitHubRepo = { nodeId: '1', id: 1, owner: 'owner', name: 'repo', fullName: 'owner/repo', description: null, url: 'https://github.com/owner/repo', homepage: null, visibility: 'public', archived: false, fork: false, language: null, topics: [], pushedAt: '2020-01-01', updatedAt: '2020-01-01', defaultBranch: 'main', openIssues: 2, stars: 0, license: null, organization: null, permissions: { admin: true, push: true, pull: true } };
describe('healthAlerts', () => { it('produit des alertes explicables', () => expect(healthAlerts(repo, undefined, 90).map((a) => a.id)).toEqual(['description', 'license', 'topics', 'inactive', 'issues'])); it('respecte les alertes ignorées', () => expect(healthAlerts(repo, { ignoredAlerts: ['license'] } as never).some((a) => a.id === 'license')).toBe(false)); });
