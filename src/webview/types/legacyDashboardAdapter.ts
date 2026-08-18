import {
  buildChangeStatusCounts,
  enrichChangeWithLifecycle,
  type ChangeStatusCounts,
} from '../../shared/changeLifecycle';
import type { ArchivedChangeInfo, ChangeInfo, DashboardData, SpecInfo } from './messages';

type LegacyChangeInfo = Omit<ChangeInfo, 'lifecycleStatus' | 'attention'> & {
  lifecycleStatus?: ChangeInfo['lifecycleStatus'];
  attention?: ChangeInfo['attention'];
};

type LegacyDashboardData = Omit<DashboardData, 'changes' | 'changeStatusCounts' | 'archivedChanges'> & {
  changes: LegacyChangeInfo[];
  archivedChanges?: ArchivedChangeInfo[];
  changeStatusCounts?: ChangeStatusCounts;
  specs?: SpecInfo[];
};

/**
 * Compatibility boundary for older fixtures/messages that omit Host lifecycle fields.
 * Production Host paths MUST publish `lifecycleStatus` and `changeStatusCounts` explicitly.
 * TODO: remove once all producers and fixtures carry the Task 2 contract.
 */
export function adaptLegacyDashboardData(data: LegacyDashboardData): DashboardData {
  const hasAllLifecycle = data.changes.every(
    (change) =>
      change.lifecycleStatus === 'planning' ||
      change.lifecycleStatus === 'ready-to-apply' ||
      change.lifecycleStatus === 'applying' ||
      change.lifecycleStatus === 'ready-to-verify'
  );
  if (hasAllLifecycle && data.changeStatusCounts && data.archivedChanges && data.specs) {
    return data as DashboardData;
  }

  const changes = data.changes.map((change) => enrichChangeWithLifecycle(change));
  const archivedChanges = data.archivedChanges ?? [];
  return {
    ...data,
    changes,
    archivedChanges,
    specs: data.specs ?? [],
    changeStatusCounts:
      data.changeStatusCounts ?? buildChangeStatusCounts(changes, archivedChanges),
  };
}
