import type { GitHubRepo, HealthAlert, RepoCustomization, RepoDetails } from '../../shared/types';
export function healthAlerts(repo: GitHubRepo, customization: RepoCustomization | undefined, inactivityDays = 90, details?: RepoDetails): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  if (!repo.description) alerts.push({ id: 'description', severity: 'info', label: 'Description absente', detail: 'Ajoutez une courte description pour reconnaître ce projet.' });
  if (!repo.license && repo.visibility === 'public') alerts.push({ id: 'license', severity: 'info', label: 'Licence absente', detail: 'Ce dépôt public ne déclare aucune licence.' });
  if (!repo.topics.length) alerts.push({ id: 'topics', severity: 'info', label: 'Aucun topic', detail: 'Les topics améliorent le classement et la découverte.' });
  if (repo.pushedAt && Date.now() - new Date(repo.pushedAt).getTime() > inactivityDays * 86_400_000) alerts.push({ id: 'inactive', severity: 'warning', label: 'Projet inactif', detail: `Aucun push depuis plus de ${inactivityDays} jours.` });
  if (details?.workflow === 'failure') alerts.push({ id: 'workflow', severity: 'error', label: 'Workflow en échec', detail: 'Le dernier workflow de la branche principale a échoué.' });
  if (repo.openIssues) alerts.push({ id: 'issues', severity: 'info', label: `${repo.openIssues} issue${repo.openIssues > 1 ? 's' : ''}`, detail: 'Des issues sont actuellement ouvertes.' });
  return alerts.filter((alert) => !customization?.ignoredAlerts.includes(alert.id));
}
