/**
 * Parse task lines from tasks.md content.
 * Matches the same format as FileManagerService.parseTasksMarkdown.
 */
import { parseTaskLine } from '../../shared/taskMarkdown';

export interface ParsedTask {
  taskIndex: number;
  lineIndex: number;
  indent: number;
  done: boolean;
  inProgress: boolean;
  text: string;
  originalLine: string;
}

export function parseTasksMarkdown(content: string): ParsedTask[] {
  const lines = content.split('\n');
  const tasks: ParsedTask[] = [];
  let taskIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const parsed = parseTaskLine(line);
    if (parsed) {
      tasks.push({
        taskIndex,
        lineIndex,
        indent: parsed.indent,
        done: parsed.done,
        inProgress: parsed.inProgress,
        text: parsed.text,
        originalLine: line.replace(/\r$/, ''),
      });
      taskIndex++;
    }
  }

  return tasks;
}

export { countTaskProgress } from '../../shared/taskMarkdown';
