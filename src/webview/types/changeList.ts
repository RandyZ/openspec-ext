import type { ActiveChangeLifecycleStatus } from '../../shared/changeLifecycle';
import type { ArchivedChangeInfo, ChangeInfo } from './messages';

export type ChangeListItemView =
  | {
      kind: 'active';
      id: string;
      lifecycleStatus: ActiveChangeLifecycleStatus;
      readOnly: false;
      change: ChangeInfo;
    }
  | {
      kind: 'archived';
      id: string;
      lifecycleStatus: 'archived';
      readOnly: true;
      archive: ArchivedChangeInfo;
    };

export function toActiveListItem(change: ChangeInfo): ChangeListItemView {
  return {
    kind: 'active',
    id: `active:${change.name}`,
    lifecycleStatus: change.lifecycleStatus,
    readOnly: false,
    change,
  };
}

export function toArchivedListItem(archive: ArchivedChangeInfo): ChangeListItemView {
  return {
    kind: 'archived',
    id: `archived:${archive.directoryName}`,
    lifecycleStatus: 'archived',
    readOnly: true,
    archive,
  };
}

export function buildChangeListItems(
  activeChanges: readonly ChangeInfo[],
  archivedChanges: readonly ArchivedChangeInfo[]
): ChangeListItemView[] {
  return [
    ...activeChanges.map(toActiveListItem),
    ...archivedChanges.map(toArchivedListItem),
  ];
}
