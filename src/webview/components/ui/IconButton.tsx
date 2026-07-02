import React from 'react';
import { Tooltip } from './Tooltip';

export type IconName = 'copy' | 'check' | 'refresh' | 'go-to-file';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
}

function IconGlyph({ icon }: { icon: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (icon === 'check') {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (icon === 'refresh') {
    return (
      <svg {...common}>
        <path d="M21 12a9 9 0 0 1-15.5 6.3" />
        <path d="M3 12A9 9 0 0 1 18.5 5.7" />
        <path d="M3 3v6h6" />
        <path d="M21 21v-6h-6" />
      </svg>
    );
  }
  if (icon === 'go-to-file') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  className = '',
  ...props
}) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded border border-transparent bg-transparent text-[var(--vscode-foreground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] ${className}`}
      {...props}
    >
      <IconGlyph icon={icon} />
    </button>
  </Tooltip>
);
