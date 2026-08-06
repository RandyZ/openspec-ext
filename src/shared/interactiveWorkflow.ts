export type InteractiveWorkflowAction = 'verify' | 'archive';
export type InteractiveWorkflowSessionStatus = 'running' | 'error';
/** Dynamic Schema artifact id, plus the reserved Verify & Archive tab. */
export type ChangeDetailTabId = string;

export const SPECS_TAB_ID = 'specs';
export const VERIFY_ARCHIVE_TAB_ID = 'verifyArchive';
export const PROPOSAL_TAB_ID = 'proposal';
export const DESIGN_TAB_ID = 'design';
export const TASKS_TAB_ID = 'tasks';

export interface InteractiveWorkflowSessionState {
  action: InteractiveWorkflowAction;
  status: InteractiveWorkflowSessionStatus;
  terminalName?: string;
  lastCommand?: string;
  startedAt?: number;
  message?: string;
}

export interface InteractiveWorkflowState {
  changeName: string;
  sessions: Partial<Record<InteractiveWorkflowAction, InteractiveWorkflowSessionState>>;
}
