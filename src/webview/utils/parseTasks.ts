/**
 * Parse task lines from tasks.md content.
 * Matches the same format as FileManagerService.parseTasksMarkdown.
 */
export interface ParsedTask {
  taskIndex: number;
  lineIndex: number;
  indent: number;
  done: boolean;
  text: string;
  originalLine: string;
}

const TASK_LINE_REGEX = /^(\s*)- \[([ xX])\] (.+)$/;

export function parseTasksMarkdown(content: string): ParsedTask[] {
  const lines = content.split('\n');
  const tasks: ParsedTask[] = [];
  let taskIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    // CRLF: line may end with \r; keep in sync with FileManagerService.parseTasksMarkdown
    const lineForMatch = line.replace(/\r$/, '');
    const match = lineForMatch.match(TASK_LINE_REGEX);
    if (match) {
      tasks.push({
        taskIndex,
        lineIndex,
        indent: match[1].length,
        done: match[2].toLowerCase() === 'x',
        text: match[3],
        originalLine: lineForMatch,
      });
      taskIndex++;
    }
  }

  return tasks;
}
