import type { GitHubRepo, RepoCustomization, RepoFilters } from '../../shared/types';
export function matchesRepo(repo: GitHubRepo, custom: RepoCustomization | undefined, search: string, filters: RepoFilters) {
  const haystack = [repo.fullName, repo.description, repo.language, ...repo.topics, ...(custom?.manualTags ?? []), custom?.notes].filter(Boolean).join(' ').toLowerCase();
  if (search && !haystack.includes(search.toLowerCase())) return false;
  if (filters.status && (custom?.status ?? 'idea') !== filters.status) return false;
  if (filters.visibility && repo.visibility !== filters.visibility) return false;
  if (filters.organization && repo.organization !== filters.organization) return false;
  if (filters.language && repo.language !== filters.language) return false;
  if (filters.favorite && !custom?.favorite) return false;
  if (filters.localOnly && !custom?.localPath) return false;
  return true;
}
