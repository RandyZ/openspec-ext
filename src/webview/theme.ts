/**
 * Shared color palette and VSCode theme variable integration.
 * Use these CSS variable names in style objects so UI respects the editor theme.
 */
export const colors = {
  foreground: 'var(--vscode-foreground)',
  descriptionForeground: 'var(--vscode-descriptionForeground)',
  background: 'var(--vscode-editor-background)',
  inputBackground: 'var(--vscode-input-background)',
  inputBorder: 'var(--vscode-input-border)',
  buttonBackground: 'var(--vscode-button-background)',
  buttonForeground: 'var(--vscode-button-foreground)',
  buttonSecondaryBackground: 'var(--vscode-button-secondaryBackground)',
  buttonSecondaryForeground: 'var(--vscode-button-secondaryForeground)',
  panelBorder: 'var(--vscode-panel-border)',
  focusBorder: 'var(--vscode-focusBorder)',
  progressBar: 'var(--vscode-progressBar-background)',
  errorBackground: 'var(--vscode-inputValidation-errorBackground)',
  errorForeground: 'var(--vscode-errorForeground)',
  warningBackground: 'var(--vscode-inputValidation-warningBackground)',
  badgeBackground: 'var(--vscode-badge-background)',
  badgeForeground: 'var(--vscode-badge-foreground)',
} as const;
