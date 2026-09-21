export type CliActivationDiagnosticCategory =
  | 'configured-path-invalid'
  | 'cli-not-found'
  | 'permission-denied'
  | 'spawn-failed'
  | 'shell-resolution-failed'
  | 'version-check-failed'
  | 'local-source-invalid'
  | 'unknown';

export type CliActivationRecoveryAction =
  | 'open-settings'
  | 'retry'
  | 'copy-diagnostics'
  | 'open-docs';

export interface BuildCliActivationDiagnosticInput {
  category: CliActivationDiagnosticCategory;
  message: string;
  rawDetails: string[];
  platform: NodeJS.Platform | string;
  arch: string;
  workspaceName: string;
  configuredCliPath?: string;
}

export interface CliActivationDiagnostic {
  category: CliActivationDiagnosticCategory;
  message: string;
  recoveryActions: CliActivationRecoveryAction[];
  safeDetails: string[];
  copyText: string;
  canRetry: boolean;
  normalizedMessage: string;
}

/** P0-1 UX order: Retry → Open Settings → Copy Diagnostics → Open Docs (link). */
const RECOVERY_ACTION_ORDER: CliActivationRecoveryAction[] = [
  'retry',
  'open-settings',
  'copy-diagnostics',
  'open-docs',
];

const RECOVERY_ACTIONS: Record<CliActivationDiagnosticCategory, CliActivationRecoveryAction[]> = {
  'configured-path-invalid': ['retry', 'open-settings', 'copy-diagnostics', 'open-docs'],
  'cli-not-found': ['retry', 'open-settings', 'copy-diagnostics', 'open-docs'],
  'permission-denied': ['retry', 'copy-diagnostics', 'open-docs'],
  'spawn-failed': ['retry', 'open-settings', 'copy-diagnostics', 'open-docs'],
  'shell-resolution-failed': ['retry', 'open-settings', 'copy-diagnostics', 'open-docs'],
  'version-check-failed': ['retry', 'copy-diagnostics', 'open-docs'],
  'local-source-invalid': ['retry', 'open-settings', 'copy-diagnostics', 'open-docs'],
  unknown: ['retry', 'copy-diagnostics', 'open-docs'],
};

export function orderRecoveryActions(
  actions: CliActivationRecoveryAction[]
): CliActivationRecoveryAction[] {
  return RECOVERY_ACTION_ORDER.filter((action) => actions.includes(action));
}

export function getRecoveryActionsForCategory(
  category: CliActivationDiagnosticCategory
): CliActivationRecoveryAction[] {
  return orderRecoveryActions(RECOVERY_ACTIONS[category]);
}

/**
 * Normalize a diagnostic message for notification dedupe.
 * Rules:
 * - Lowercase
 * - Replace absolute user paths with <path>/basename
 * - Replace durations (e.g. 403ms) with <duration>
 * - Replace attempt numbers with <n>
 * - Replace timestamps with <timestamp>
 * - Collapse whitespace
 * - Preserve error codes (ENOENT, EACCES, EPERM, exit codes)
 * - Truncate to 160 characters
 */
export function normalizeDiagnosticMessage(message: string): string {
  return message
    .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)+([^\\\s]+)/g, '<path>/$1')
    .replace(/\/(?:Users|home)\/[^/\s]+(?:\/[^/\s]+)*\/([^/\s]+)/g, '<path>/$1')
    .replace(/\b\d+(?:\.\d+)?\s*ms\b/gi, '<duration>')
    .replace(/\battempt\s+\d+(?:\/\d+)?\b/gi, 'attempt <n>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<timestamp>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

/**
 * Sanitize diagnostic details for user-facing display.
 * Filters out sensitive environment variables and redacts paths.
 */
export function sanitizeDiagnosticDetails(details: string[]): string[] {
  return details
    .filter((detail) => !/(token|key|secret|password)/i.test(detail))
    .map((detail) => {
      if (/process\.env\.PATH=/.test(detail)) {
        return 'process.env.PATH=<redacted path list>';
      }
      return detail
        .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)+([^\\\s]+)/g, '<path>/$1')
        .replace(/\/(?:Users|home)\/[^/\s]+(?:\/[^/\s]+)*\/([^/\s]+)/g, '<path>/$1');
    });
}

/**
 * Build a complete CliActivationDiagnostic from raw inputs.
 * Generates safe details, copy text, and normalized message.
 */
export function buildCliActivationDiagnostic(
  input: BuildCliActivationDiagnosticInput
): CliActivationDiagnostic {
  const recoveryActions = getRecoveryActionsForCategory(input.category);
  const normalizedMessage = normalizeDiagnosticMessage(input.message);
  const configuredCliPath = input.configuredCliPath
    ? input.configuredCliPath
        .replace(/[A-Za-z]:\\(?:[^\\\s]+\\)+([^\\\s]+)/g, '<path>/$1')
        .replace(/\/(?:Users|home)\/[^/\s]+(?:\/[^/\s]+)*\/([^/\s]+)/g, '<path>/$1')
    : '<empty>';
  const safeDetails = sanitizeDiagnosticDetails(input.rawDetails);
  const copyLines = [
    'OpenSpec CLI activation diagnostic',
    `category=${input.category}`,
    `message=${normalizedMessage}`,
    `platform=${input.platform}`,
    `arch=${input.arch}`,
    `workspace=${input.workspaceName}`,
    `configuredCliPath=${configuredCliPath}`,
    `recoveryActions=${recoveryActions.join(',')}`,
    ...safeDetails.map((detail) => `detail=${detail}`),
  ];

  return {
    category: input.category,
    message: input.message,
    recoveryActions,
    safeDetails,
    copyText: copyLines.join('\n'),
    canRetry: recoveryActions.includes('retry'),
    normalizedMessage,
  };
}
