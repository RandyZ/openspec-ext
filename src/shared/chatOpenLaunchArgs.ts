/** VS Code / Copilot `workbench.action.chat.open` options (isPartialQuery: false submits). */
export interface ChatOpenLaunchArgs {
  query: string;
  isPartialQuery: boolean;
  mode?: 'agent';
}

export function buildChatOpenLaunchArgs(text: string, autoSubmit: boolean): ChatOpenLaunchArgs {
  return {
    query: text,
    isPartialQuery: !autoSubmit,
    mode: 'agent',
  };
}
