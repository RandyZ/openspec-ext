export type InteractiveWorkflowAction = 'verify' | 'archive';
export type InteractiveWorkflowSessionStatus = 'running' | 'error';
export type ChangeDetailTabId = 'proposal' | 'specs' | 'design' | 'tasks' | 'verifyArchive';

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
