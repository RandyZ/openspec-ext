import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const buttonVariants = cva(
  'rounded font-medium cursor-pointer border-none transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[var(--vscode-focusBorder)]',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]',
        secondary: 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]',
        outline: 'bg-transparent text-[var(--vscode-foreground)] border border-[var(--vscode-button-border)]',
        ghost: 'bg-transparent text-[var(--vscode-foreground)]',
        danger: 'bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-editor-foreground)]',
      },
      size: {
        sm: 'px-2 py-1 text-[11px]',
        md: 'px-3 py-1.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  className = '',
  children,
  ...props
}) => (
  <button
    type="button"
    className={buttonVariants({ variant, size, className })}
    {...props}
  >
    {children}
  </button>
);
