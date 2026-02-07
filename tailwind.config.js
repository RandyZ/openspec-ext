/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/webview/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VSCode theme colors
        'vscode-fg': 'var(--vscode-foreground)',
        'vscode-bg': 'var(--vscode-editor-background)',
        'vscode-button': 'var(--vscode-button-background)',
        'vscode-button-hover': 'var(--vscode-button-hoverBackground)',
        'vscode-input-bg': 'var(--vscode-input-background)',
        'vscode-input-border': 'var(--vscode-input-border)',
      },
    },
  },
  plugins: [],
}
