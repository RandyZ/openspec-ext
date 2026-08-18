import type { ChangeInfo } from '../types/messages';
import { toActiveListItem } from '../types/changeList';
import { searchItems } from './changeListPipeline';

export function filterChanges(changes: ChangeInfo[], query: string): ChangeInfo[] {
  const items = changes.map(toActiveListItem);
  return searchItems(items, query)
    .filter((item): item is Extract<typeof item, { kind: 'active' }> => item.kind === 'active')
    .map((item) => item.change);
}
