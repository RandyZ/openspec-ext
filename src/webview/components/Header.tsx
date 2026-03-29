import React from 'react';
import { t } from '../../i18n';

interface HeaderProps {
  onRefresh: () => void;
  onNewChange?: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, onNewChange, loading }) => {
  return (
    <div className="mb-4 pb-3 border-b" style={{ 
      borderColor: 'var(--vscode-panel-border)' 
    }}>
      <h1 className="text-xl font-bold mb-2" style={{ 
        color: 'var(--vscode-textLink-foreground)' 
      }}>
        OpenSpec
      </h1>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1 text-xs rounded"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? `⟳ ${t('header.loading')}` : `⟳ ${t('header.refresh')}`}
        </button>
        {onNewChange && (
          <button
            onClick={onNewChange}
            className="px-3 py-1 text-xs rounded"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              cursor: 'pointer',
            }}
          >
            {t('header.newChange')}
          </button>
        )}
      </div>
    </div>
  );
};
