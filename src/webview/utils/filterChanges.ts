import type { ChangeInfo } from '../types/messages';

function changeSearchHaystack(change: ChangeInfo): string {
  const artifacts = (change.artifacts ?? [])
    .map((artifact) => `${artifact.id} ${artifact.status}`)
    .join(' ');

  return [
    change.name,
    change.status,
    artifacts,
    change.proposalWhySummary,
    change.proposalWhyFullText,
    change.searchText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterChanges(changes: ChangeInfo[], query: string): ChangeInfo[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return changes;

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return changes.filter((change) => {
    const haystack = changeSearchHaystack(change);
    return terms.every((term) => haystack.includes(term));
  });
}
