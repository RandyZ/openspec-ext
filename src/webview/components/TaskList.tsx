import React, { useMemo, useCallback, useState } from 'react';
import { TaskCheckbox } from './TaskCheckbox';
import { parseTasksMarkdown, ParsedTask } from '../utils/parseTasks';
import { t } from '../../i18n';
import type { WorkflowLaunchConfigView } from '../../shared/workflowLaunchConfig';
import {
  getPrimaryBlockingDependency,
  getRecommendedTaskIndex,
  isTaskBlockedByDependencies,
  type TaskDependencyPolicy,
} from '../../shared/taskExecutionUi';
import { getTaskNextButtonLabel } from '../utils/taskNextButtonLabels';

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
  /** Executor-resolved UI config (Change detail). Takes precedence over workflowLaunchConfig. */
  executorUiLaunchConfig?: WorkflowLaunchConfigView | null;
  /** Settings-based config (Dashboard). Ignored when executorUiLaunchConfig is set. */
  workflowLaunchConfig?: WorkflowLaunchConfigView | null;
  taskDependencyPolicy?: TaskDependencyPolicy;
  onToggleTask: (changeName: string, taskIndex: number, taskText: string, done: boolean) => void;
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

function getBlockedReason(tasks: ParsedTask[], taskIndex: number): string | null {
  const dependency = getPrimaryBlockingDependency(tasks, taskIndex);
  if (!dependency) return null;
  return t('task.blockedWaiting', { dep: dependency.text });
}

export const TaskList: React.FC<TaskListProps> = ({
  content,
  changeName,
  isArchived = false,
  executingTaskIndex = null,
  executionState = {},
  executorUiLaunchConfig = null,
  workflowLaunchConfig = null,
  taskDependencyPolicy = 'block',
  onToggleTask,
  onExecuteTask,
}) => {
  const [blockedNoticeTaskIndex, setBlockedNoticeTaskIndex] = useState<number | null>(null);
  const tasks = useMemo(() => parseTasksMarkdown(content), [content]);
  const recommendedTaskIndex = useMemo(
    () => getRecommendedTaskIndex(tasks, taskDependencyPolicy),
    [tasks, taskDependencyPolicy],
  );

  const handleToggle = useCallback(
    (task: ParsedTask) => {
      onToggleTask(changeName, task.taskIndex, task.text, task.done);
    },
    [changeName, onToggleTask]
  );

  const handleExecuteClick = useCallback(
    (task: ParsedTask, blocked: boolean, blockedReason: string | null) => {
      if (executingTaskIndex === task.taskIndex) return;
      if (blocked) {
        setBlockedNoticeTaskIndex(task.taskIndex);
        return;
      }
      setBlockedNoticeTaskIndex(null);
      onExecuteTask?.(changeName, task.taskIndex, task.text);
    },
    [changeName, executingTaskIndex, onExecuteTask],
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
      {tasks.map((task) => {
        const isExecuting = executingTaskIndex === task.taskIndex;
        const isBlocked = !task.done && isTaskBlockedByDependencies(tasks, task.taskIndex, taskDependencyPolicy);
        const blockedReason = isBlocked ? getBlockedReason(tasks, task.taskIndex) : null;
        const isRecommended = !task.done && task.taskIndex === recommendedTaskIndex;
        const showAction = onExecuteTask && !isArchived && !task.done;
        const labelLaunchConfig = executorUiLaunchConfig ?? workflowLaunchConfig;
        const buttonLabel = getTaskNextButtonLabel(labelLaunchConfig, { working: isExecuting });
        const isPrimary = isRecommended && !isBlocked && !isExecuting;
        const buttonTitle = isBlocked
          ? blockedReason ?? undefined
          : isExecuting
            ? buttonLabel
            : undefined;

        return (
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
                  {formatExecutionTime(executionState[task.taskIndex].timestamp)}{' '}
                  {executionState[task.taskIndex].success ? '✓' : '✗'}
                </span>
              )}
              {showAction && (
                <>
                  {isBlocked && (
                    <span
                      className="codicon codicon-warning"
                      title={blockedReason ?? undefined}
                      aria-hidden="true"
                      style={{
                        color: 'var(--vscode-editorWarning-foreground, #cca700)',
                        fontSize: '14px',
                      }}
                    />
                  )}
                  <button
                    type="button"
                    aria-disabled={isBlocked || isExecuting}
                    disabled={isExecuting}
                    title={buttonTitle}
                    onClick={() => handleExecuteClick(task, isBlocked, blockedReason)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: isBlocked ? 'not-allowed' : isExecuting ? 'wait' : 'pointer',
                      border: '1px solid var(--vscode-button-border, transparent)',
                      borderRadius: '4px',
                      background: isPrimary
                        ? 'var(--vscode-button-background)'
                        : isExecuting
                          ? 'var(--vscode-button-background)'
                          : 'var(--vscode-button-secondaryBackground)',
                      color: isPrimary || isExecuting
                        ? 'var(--vscode-button-foreground)'
                        : 'var(--vscode-button-secondaryForeground)',
                      opacity: isBlocked ? 0.65 : isExecuting ? 0.8 : 1,
                    }}
                  >
                    {buttonLabel}
                  </button>
                </>
              )}
              {blockedNoticeTaskIndex === task.taskIndex && blockedReason && (
                <span
                  role="status"
                  style={{
                    fontSize: '11px',
                    color: 'var(--vscode-editorWarning-foreground, #cca700)',
                    maxWidth: '180px',
                  }}
                >
                  {blockedReason}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
