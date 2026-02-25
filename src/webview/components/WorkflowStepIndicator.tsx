import React from 'react';
import { type StepInfo, type WorkflowStep, getStepLabel } from '../utils/workflowState';

export interface WorkflowStepIndicatorProps {
  steps: StepInfo[];
  onStepClick: (step: WorkflowStep) => void;
  isArchived: boolean;
}

const DOT_SIZE = 18;

const statusColors: Record<string, { dot: string; text: string; line: string }> = {
  done: {
    dot: 'var(--vscode-testing-iconPassed, #4caf50)',
    text: 'var(--vscode-foreground)',
    line: 'var(--vscode-testing-iconPassed, #4caf50)',
  },
  current: {
    dot: 'var(--vscode-progressBar-background, #0078d4)',
    text: 'var(--vscode-progressBar-background, #0078d4)',
    line: 'var(--vscode-panel-border)',
  },
  upcoming: {
    dot: 'var(--vscode-panel-border)',
    text: 'var(--vscode-descriptionForeground)',
    line: 'var(--vscode-panel-border)',
  },
};

export const WorkflowStepIndicator: React.FC<WorkflowStepIndicatorProps> = ({
  steps,
  onStepClick,
  isArchived,
}) => {
  return (
    <div
      className="flex items-center overflow-x-auto"
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editor-background)',
        gap: 0,
        minHeight: 36,
      }}
    >
      {steps.map((info, i) => {
        const colors = statusColors[info.status];
        const isClickable =
          info.status === 'done' || (info.status === 'current' && !isArchived);
        const showLine = i < steps.length - 1;

        return (
          <React.Fragment key={info.step}>
            <button
              type="button"
              onClick={() => isClickable && onStepClick(info.step)}
              className="flex items-center gap-1 shrink-0"
              style={{
                background: 'none',
                border: 'none',
                cursor: isClickable ? 'pointer' : 'default',
                padding: '2px 4px',
                borderRadius: 4,
                opacity: info.status === 'upcoming' ? 0.5 : 1,
              }}
              title={
                info.status === 'done'
                  ? `View ${getStepLabel(info.step)}`
                  : info.status === 'current' && !isArchived
                    ? `Start ${getStepLabel(info.step)}`
                    : getStepLabel(info.step)
              }
            >
              <span
                className="flex items-center justify-center shrink-0"
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: '50%',
                  background: info.status === 'current' ? colors.dot : 'transparent',
                  border: `2px solid ${colors.dot}`,
                  fontSize: 10,
                  color: info.status === 'current' ? '#fff' : colors.dot,
                  fontWeight: 600,
                }}
              >
                {info.status === 'done' ? '✓' : i + 1}
              </span>
              <span
                className="text-xs whitespace-nowrap hidden sm:inline"
                style={{ color: colors.text, fontWeight: info.status === 'current' ? 600 : 400 }}
              >
                {getStepLabel(info.step)}
              </span>
            </button>
            {showLine && (
              <div
                className="shrink-0"
                style={{
                  width: 16,
                  height: 2,
                  background:
                    info.status === 'done'
                      ? statusColors.done.line
                      : statusColors.upcoming.line,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
