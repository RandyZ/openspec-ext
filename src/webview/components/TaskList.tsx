import React, { useMemo, useState, useCallback } from 'react';
import { TaskCheckbox } from './TaskCheckbox';
import { parseTasksMarkdown, ParsedTask } from '../utils/parseTasks';

export interface TaskListProps {
  content: string;
  changeName: string;
  onToggleTask: (changeName: string, taskIndex: number) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  content,
  changeName,
  onToggleTask,
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
            marginBottom: '4px',
          }}
        >
          <TaskCheckbox
            checked={getDone(task)}
            onToggle={() => handleToggle(task)}
            label={task.text}
            indent={task.indent}
            animate
          />
        </li>
      ))}
    </ul>
  );
};
