import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style }) => (
  <div
    className={`rounded p-3 ${className}`}
    style={{
      background: 'var(--vscode-input-background)',
      border: '1px solid var(--vscode-panel-border)',
      ...style,
    }}
  >
    {children}
  </div>
);
