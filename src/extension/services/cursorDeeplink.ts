const CURSOR_PROMPT_DEEPLINK = 'cursor://anysphere.cursor-deeplink/prompt';

export function buildCursorPromptDeeplink(command: string): string {
  return `${CURSOR_PROMPT_DEEPLINK}?text=${encodeURIComponent(command)}`;
}
