/** Shared tasks.md line parsing — keep webview + extension host in sync. */

export type TaskMarker = 'open' | 'done' | 'inProgress';

export interface ParsedTaskLine {
  indent: number;
  marker: TaskMarker;
  done: boolean;
  inProgress: boolean;
  text: string;
}

const TASK_LINE_REGEX = /^(\s*)- \[([ xX~])\] (.+)$/;

export function parseTaskLine(line: string): ParsedTaskLine | null {
  const lineForMatch = line.replace(/\r$/, '');
  const match = lineForMatch.match(TASK_LINE_REGEX);
  if (!match) return null;
  const markerChar = match[2];
  const marker: TaskMarker = markerChar === '~'
    ? 'inProgress'
    : markerChar.toLowerCase() === 'x'
      ? 'done'
      : 'open';
  return {
    indent: match[1].length,
    marker,
    done: marker === 'done',
    inProgress: marker === 'inProgress',
    text: match[3],
  };
}

export function countTaskProgress(content: string): { completed: number; total: number } {
  const lines = content.split('\n');
  let total = 0;
  let completed = 0;
  for (const line of lines) {
    const parsed = parseTaskLine(line);
    if (!parsed) continue;
    total += 1;
    if (parsed.done) completed += 1;
  }
  return { completed, total };
}
