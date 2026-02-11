import React from 'react';

export type BadgeStatus = 'done' | 'ready' | 'blocked' | 'default';

export interface BadgeProps {
  children: React.ReactNode;
  status?: BadgeStatus;
  className?: string;
}

const statusStyles: Record<BadgeStatus, React.CSSProperties> = {
  done: { background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50' },
  ready: { background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107' },
  blocked: { background: 'rgba(158, 158, 158, 0.2)', color: '#9e9e9e' },
  default: {
    background: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  status = 'default',
  className = '',
}) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
    style={statusStyles[status]}
  >
    {children}
  </span>
);
