import React, { useMemo, useCallback } from 'react';
import { TaskCheckbox } from './TaskCheckbox';
import { parseTasksMarkdown, ParsedTask } from '../utils/parseTasks';
import { t } from '../../i18n';

export interface TaskExecutionStateItem {
  success: boolean;
  timestamp: number;
}

export interface TaskListProps {
  content: string;
  changeName: string;
  isArchived?: boolean;
  executingTaskIndex?: number | null;
  executionState?: Record<number, TaskExecutionStateItem>;
  onToggleTask: (changeName: string, taskIndex: number) => void;
  onExecuteTask?: (changeName: string, taskIndex: number, taskText: string) => void;
}

function formatExecutionTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const TaskList: React.FC<TaskListProps> = ({
  content,
  changeName,
  isArchived = false,
  executingTaskIndex = null,
  executionState = {},
  onToggleTask,
  onExecuteTask,
}) => {
  const tasks = useMemo(() => parseTasksMarkdown(content), [content]);

  const handleToggle = useCallback(
    (task: ParsedTask) => {
      onToggleTask(changeName, task.taskIndex);
    },
    [changeName, onToggleTask]
  );

  if (tasks.length === 0) {
    return (
      <div
        className="py-6 text-sm"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {t('task.empty')}
      </div>
    );
  }

  return (
    <ul
      className="task-list"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: '8px 0',
      }}
    >
      {tasks.map((task) => (
        <li
          key={`${task.lineIndex}-${task.taskIndex}`}
          style={{
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <TaskCheckbox
              checked={task.done}
              onToggle={() => handleToggle(task)}
              label={task.text}
              indent={task.indent}
              disabled={isArchived}
              animate
            />
          </div>
          <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {executionState[task.taskIndex] && (
              <span
                title={executionState[task.taskIndex].success ? t('task.lastSuccess') : t('task.lastFailed')}
                style={{
                  fontSize: '11px',
                  color: executionState[task.taskIndex].success
                    ? 'var(--vscode-testing-iconPassed)'
                    : 'var(--vscode-errorForeground)',
                }}
              >
                {formatExecutionTime(executionState[task.taskIndex].timestamp)} {executionState[task.taskIndex].success ? '✓' : '✗'}
              </span>
            )}
            {onExecuteTask && !isArchived && (
              <button
                type="button"
                disabled={executingTaskIndex === task.taskIndex}
                onClick={() => onExecuteTask(changeName, task.taskIndex, task.text)}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: executingTaskIndex === task.taskIndex ? 'wait' : 'pointer',
                  border: '1px solid var(--vscode-button-border, transparent)',
                  borderRadius: '4px',
                  background:
                    executingTaskIndex === task.taskIndex
                      ? 'var(--vscode-button-background)'
                      : 'var(--vscode-button-secondaryBackground)',
                  color:
                    executingTaskIndex === task.taskIndex
                      ? 'var(--vscode-button-foreground)'
                      : 'var(--vscode-button-secondaryForeground)',
                  opacity: executingTaskIndex === task.taskIndex ? 0.8 : 1,
                }}
              >
                {executingTaskIndex === task.taskIndex ? t('task.executing') : t('task.execute')}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};
