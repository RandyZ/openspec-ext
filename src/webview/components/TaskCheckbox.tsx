import React, { useMemo } from 'react';
import { renderTaskLabelMarkdown } from '../utils/taskLabelMarkdown';

export interface TaskCheckboxProps {
  checked: boolean;
  inProgress?: boolean;
  onToggle: () => void;
  label: string;
  indent: number;
  disabled?: boolean;
  animate?: boolean;
}

const INDENT_PX = 18;

export const TaskCheckbox: React.FC<TaskCheckboxProps> = ({
  checked,
  inProgress = false,
  onToggle,
  label,
  indent,
  disabled = false,
  animate = true,
}) => {
  const labelHtml = useMemo(() => renderTaskLabelMarkdown(label), [label]);

  return (
    <label
      className="task-checkbox"
      onClick={(event) => {
        if (inProgress && !disabled) {
          event.preventDefault();
          onToggle();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        paddingLeft: indent * INDENT_PX,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        transition: animate ? 'opacity 0.15s ease' : undefined,
      }}
    >
      {inProgress ? (
        <span
          aria-hidden="true"
          style={{
            marginTop: '2px',
            flexShrink: 0,
            width: '16px',
            height: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <span
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '2px',
              border: '1px solid var(--vscode-checkbox-border, var(--vscode-contrastBorder, #888))',
              background: 'transparent',
              boxSizing: 'border-box',
            }}
          />
          <span
            className="codicon codicon-circle-filled"
            style={{
              position: 'absolute',
              right: '-1px',
              bottom: '-1px',
              fontSize: '7px',
              color: 'var(--vscode-editorWarning-foreground, #cca700)',
            }}
          />
        </span>
      ) : (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          style={{
            marginTop: '3px',
            flexShrink: 0,
            width: '16px',
            height: '16px',
            accentColor: checked
              ? 'var(--vscode-testing-iconPassed, var(--vscode-checkbox-selectBackground))'
              : 'var(--vscode-checkbox-selectBackground)',
          }}
        />
      )}
      <span
        className="markdown-body task-inline-md"
        style={{
          flex: 1,
          color: checked
            ? 'var(--vscode-testing-iconPassed, var(--vscode-foreground))'
            : 'var(--vscode-foreground)',
          fontSize: '13px',
          lineHeight: 1.5,
          textDecoration: checked ? 'line-through' : undefined,
          opacity: checked ? 0.75 : 1,
          transition: animate ? 'opacity 0.15s ease, text-decoration 0.15s ease' : undefined,
        }}
        dangerouslySetInnerHTML={{ __html: labelHtml }}
      />
    </label>
  );
};
