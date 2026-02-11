import React from 'react';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }
      if (fallback) {
        return fallback;
      }
      return (
        <div
          className="p-4 rounded text-sm"
          style={{
            background: 'var(--vscode-inputValidation-errorBackground)',
            color: 'var(--vscode-errorForeground)',
          }}
        >
          <p className="font-medium mb-1">Something went wrong</p>
          <p className="mb-2">{error.message}</p>
          <button
            type="button"
            className="px-2 py-1 rounded text-xs cursor-pointer border-none"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
            onClick={this.reset}
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}
