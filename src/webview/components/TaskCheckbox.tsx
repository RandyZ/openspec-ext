import React from 'react';

export interface TaskCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  indent: number;
  disabled?: boolean;
  animate?: boolean;
}

const INDENT_PX = 16;

export const TaskCheckbox: React.FC<TaskCheckboxProps> = ({
  checked,
  onToggle,
  label,
  indent,
  disabled = false,
  animate = true,
}) => {
  return (
    <label
      className="task-checkbox"
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
          accentColor: 'var(--vscode-checkbox-selectBackground)',
        }}
      />
      <span
        style={{
          flex: 1,
          color: 'var(--vscode-foreground)',
          fontSize: '13px',
          lineHeight: 1.5,
          textDecoration: checked ? 'line-through' : undefined,
          opacity: checked ? 0.75 : 1,
          transition: animate ? 'opacity 0.15s ease, text-decoration 0.15s ease' : undefined,
        }}
      >
        {label}
      </span>
    </label>
  );
};
