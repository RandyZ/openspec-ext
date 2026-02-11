import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

const sizePx = { sm: 16, md: 24 };

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  style,
}) => {
  const px = sizePx[size];
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full border-2 border-solid border-transparent ${className}`}
      style={{
        width: px,
        height: px,
        borderTopColor: 'var(--vscode-foreground)',
        animation: 'ui-spin 0.7s linear infinite',
        ...style,
      }}
    />
  );
};
