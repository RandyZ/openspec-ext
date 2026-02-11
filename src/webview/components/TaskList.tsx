import React, { useMemo, useState, useCallback } from 'react';
import { TaskCheckbox } from './TaskCheckbox';
import { parseTasksMarkdown, ParsedTask } from '../utils/parseTasks';

export interface TaskListProps {
  content: string;
  changeName: string;
  executingTaskIndex?: number | null;
  onToggleTask: (changeName: string, taskIndex: number) => void;
  onExecuteTask?: (changeName: string, taskIndex: number, taskText: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  content,
  changeName,
  executingTaskIndex = null,
  onToggleTask,
  onExecuteTask,
}) => {
  const tasks = useMemo(() => parseTasksMarkdown(content), [content]);

  const [optimisticDone, setOptimisticDone] = useState<Record<number, boolean>>({});

  const getDone = useCallback(
    (task: ParsedTask) => {
      if (task.taskIndex in optimisticDone) {
        return optimisticDone[task.taskIndex];
      }
      return task.done;
    },
    [optimisticDone]
  );

  const handleToggle = useCallback(
    (task: ParsedTask) => {
      const currentDone = getDone(task);
      setOptimisticDone((prev) => ({ ...prev, [task.taskIndex]: !currentDone }));
      onToggleTask(changeName, task.taskIndex);
    },
    [changeName, getDone, onToggleTask]
  );

  if (tasks.length === 0) {
    return (
      <div
        className="py-6 text-sm"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        暂无任务项，或 tasks.md 中尚无 <code>- [ ]</code> / <code>- [x]</code> 格式的任务行。
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
              checked={getDone(task)}
              onToggle={() => handleToggle(task)}
              label={task.text}
              indent={task.indent}
              animate
            />
          </div>
          {onExecuteTask && (
            <button
              type="button"
              disabled={executingTaskIndex === task.taskIndex}
              onClick={() => onExecuteTask(changeName, task.taskIndex, task.text)}
              style={{
                flexShrink: 0,
                marginLeft: 'auto',
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
              {executingTaskIndex === task.taskIndex ? '执行中...' : '执行'}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};
