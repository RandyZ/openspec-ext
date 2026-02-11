import React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

export interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className = '',
  style,
}) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <ProgressPrimitive.Root
      value={percent}
      max={100}
      className={`h-2 w-full overflow-hidden rounded-full ${className}`}
      style={{
        background: 'var(--vscode-input-border)',
        ...style,
      }}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full transition-[width] duration-200 ease-out"
        style={{
          width: `${percent}%`,
          background: 'var(--vscode-progressBar-background)',
        }}
      />
    </ProgressPrimitive.Root>
  );
};
