/**
 * Task checkbox counting aligned with OpenSpec CLI (`utils/task-progress.js`).
 * Used for dashboard progress only; UI task-line parsing may stay stricter for toggles.
 */

const TASK_LINE_PATTERN =
  /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/;

export interface OpenSpecTaskLineCount {
  done: boolean;
  description: string;
}

export function parseOpenSpecTaskLineForCount(line: string): OpenSpecTaskLineCount | null {
  const match = line.replace(/\r$/, '').match(TASK_LINE_PATTERN);
  if (!match) return null;
  return {
    done: (match[1] ?? '').toLowerCase() === 'x',
    description: match[2].trim(),
  };
}

export function countOpenSpecTaskProgress(content: string): { completed: number; total: number } {
  let total = 0;
  let completed = 0;
  for (const line of content.split('\n')) {
    const parsed = parseOpenSpecTaskLineForCount(line);
    if (!parsed) continue;
    total += 1;
    if (parsed.done) completed += 1;
  }
  return { completed, total };
}
