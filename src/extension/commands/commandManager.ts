import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { DashboardViewProvider } from '../providers/dashboardViewProvider';
import { getAvailableAdapters, getCurrentAdapter } from '../adapters';
import { t } from '../../i18n';
import { confirmDirectArchive } from './archiveConfirm';

export class CommandManager {
  constructor(
    private dataManager: DataManager,
    private context: vscode.ExtensionContext,
    private dashboardViewProvider: DashboardViewProvider
  ) {}

  /**
   * Register all commands
   */
  register(): void {
    const commands = [
      vscode.commands.registerCommand('openspec.openDashboard', () =>
        this.handleOpenDashboard()
      ),
      vscode.commands.registerCommand('openspec.refreshData', () =>
        this.handleRefreshData()
      ),
      vscode.commands.registerCommand('openspec.newChange', () =>
        this.handleNewChange()
      ),
      vscode.commands.registerCommand('openspec.archiveChange', (changeName?: string) =>
        this.handleArchiveChange(changeName)
      ),
      vscode.commands.registerCommand(
        'openspec.openChangeDetail',
        (changeName: string, initialTab?: string, interactiveAction?: string) =>
          this.handleOpenChangeDetail(changeName, initialTab, interactiveAction)
      ),
      vscode.commands.registerCommand('openspec.selectAgentAdapter', () =>
        this.handleSelectAgentAdapter()
      ),
      vscode.commands.registerCommand(
        'openspec.continueArtifact',
        (changeName?: string, artifactType?: string) =>
          this.handleContinueArtifact(changeName, artifactType)
      ),
    ];

    commands.forEach((cmd) => this.context.subscriptions.push(cmd));
    logger.info(`Registered ${commands.length} commands`);
  }

  /**
   * Open OpenSpec Dashboard (optionally reveal sidebar view per setting)
   */
  private async handleOpenDashboard(): Promise<void> {
    try {
      const focusSidebar = vscode.workspace.getConfiguration('openspec').get<boolean>('focusSidebarViewWhenOpeningDashboard');
      if (focusSidebar) {
        logger.info('Revealing OpenSpec dashboard view...');
        this.dashboardViewProvider.reveal();
        await vscode.commands.executeCommand(`${DashboardViewProvider.viewType}.focus`);
      } else {
        logger.info('Opening OpenSpec dashboard editor panel...');
        this.dashboardViewProvider.openInEditor();
      }
    } catch (error) {
      logger.error('Failed to open dashboard', error as Error);
      vscode.window.showErrorMessage(t('command.dashboardFailed'));
    }
  }

  /**
   * Refresh OpenSpec data
   */
  private async handleRefreshData(): Promise<void> {
    try {
      logger.info('Refreshing OpenSpec data...');

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('command.refreshing'),
          cancellable: false,
        },
        async () => {
          await this.dataManager.refresh();
        }
      );

      vscode.window.showInformationMessage(t('command.refreshed'));
    } catch (error) {
      logger.error('Failed to refresh data', error as Error);
      vscode.window.showErrorMessage(t('command.refreshFailed'));
    }
  }

  /**
   * Create new change
   */
  private async handleNewChange(): Promise<void> {
    try {
      const name = await vscode.window.showInputBox({
        prompt: t('command.enterName'),
        placeHolder: t('command.namePlaceholder'),
        validateInput: (value) => {
          if (!value) {
            return t('command.nameRequired');
          }
          if (!/^[a-z0-9-]+$/.test(value)) {
            return t('command.nameFormat');
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      logger.info(`Creating change: ${name}`);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('command.creating', { name }),
          cancellable: false,
        },
        async () => {
          await this.dataManager.createChange(name);
        }
      );

      vscode.window.showInformationMessage(t('command.created', { name }));
    } catch (error) {
      logger.error('Failed to create change', error as Error);
      vscode.window.showErrorMessage(t('command.createFailed'));
    }
  }

  /**
   * Archive a change
   */
  private async handleArchiveChange(changeName?: string): Promise<void> {
    try {
      // If no change name provided, show quick pick
      if (!changeName) {
        const data = await this.dataManager.getDashboardData();
        const items = data.changes.map((c) => ({
          label: c.name,
          description: `${c.completedTasks}/${c.totalTasks} tasks`,
        }));

        if (items.length === 0) {
          vscode.window.showInformationMessage(t('command.noChanges'));
          return;
        }

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: t('command.selectArchive'),
        });

        if (!selected) {
          return;
        }

        changeName = selected.label;
      }

      // Confirm archive with verify-first guidance (workflow-control spec:
      // "Direct archive keeps Verify guidance").
      const confirm = await confirmDirectArchive(changeName!);
      if (confirm === 'verifyFirst') {
        // Route the user into the interactive Verify & Archive tab instead of
        // archiving directly. This is the recommended path.
        this.dashboardViewProvider.openChangeDetail(changeName!, {
          initialTab: 'verifyArchive',
          interactiveAction: 'verify',
        });
        return;
      }
      if (confirm !== 'archive') {
        return;
      }


      logger.info(`Archiving change: ${changeName}`);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('command.archiving', { name: changeName }),
          cancellable: false,
        },
        async () => {
          await this.dataManager.archiveChange(changeName!);
        }
      );

      vscode.window.showInformationMessage(t('command.archived', { name: changeName }));
    } catch (error) {
      logger.error('Failed to archive change', error as Error);
      vscode.window.showErrorMessage(t('command.archiveFailed'));
    }
  }

  /**
   * Open the Change Detail editor, optionally at a specific tab with an
   * interactive workflow action to auto-start. Invoked by the
   * `openspec.openChangeDetail` command (used by the direct-archive
   * verify-first guidance to route into the `Verify & Archive` tab).
   *
   * `initialTab` / `interactiveAction` are received as strings from the
   * command API and narrowed here.
   */
  private handleOpenChangeDetail(
    changeName: string,
    initialTab?: string,
    interactiveAction?: string
  ): void {
    if (typeof changeName !== 'string' || !changeName.trim()) return;
    const validTabs = ['proposal', 'specs', 'design', 'tasks', 'verifyArchive'] as const;
    const validActions = ['verify', 'archive'] as const;
    const tab =
      initialTab && (validTabs as readonly string[]).includes(initialTab)
        ? (initialTab as (typeof validTabs)[number])
        : undefined;
    const action =
      interactiveAction && (validActions as readonly string[]).includes(interactiveAction)
        ? (interactiveAction as (typeof validActions)[number])
        : undefined;
    this.dashboardViewProvider.openChangeDetail(changeName, {
      ...(tab !== undefined ? { initialTab: tab } : {}),
      ...(action !== undefined ? { interactiveAction: action } : {}),
    });
  }

  /**
   * Copy /opsx:continue with artifact-specific prompt to clipboard.
   * Each artifact type gets a different prompt so the AI knows exactly what to create.
   */
  private async handleContinueArtifact(changeName?: string, artifactType?: string): Promise<void> {
    const name = changeName?.trim();
    const text = this.buildContinuePrompt(name, artifactType);
    await vscode.env.clipboard.writeText(text);
    const artifactLabel = this.getArtifactLabel(artifactType);
    vscode.window.showInformationMessage(
      name
        ? t('command.copiedContinue', { artifact: artifactLabel })
        : t('command.copiedContinueGeneric')
    );
  }

  private buildContinuePrompt(changeName: string | undefined, _artifactType: string | undefined): string {
    return changeName ? `/opsx:continue ${changeName}` : '/opsx:continue';
  }

  private getArtifactLabel(artifactType: string | undefined): string {
    switch (artifactType) {
      case 'proposal': return 'Proposal';
      case 'specs': return 'Specs';
      case 'design': return 'Design';
      case 'tasks': return 'Tasks';
      default: return 'artifact';
    }
  }

  /**
   * Select preferred Agent adapter (Quick Pick).
   */
  private async handleSelectAgentAdapter(): Promise<void> {
    try {
      const available = await getAvailableAdapters();
      if (available.length === 0) {
        vscode.window.showInformationMessage(t('adapter.noAvailable'));
        return;
      }
      const current = await getCurrentAdapter();
      const items = available.map((a) => ({
        label: a.displayName,
        description: a.id === current?.id ? t('adapter.current') : undefined,
        id: a.id,
      }));
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('adapter.selectPlaceholder'),
        matchOnDescription: true,
      });
      if (!selected) return;
      const config = vscode.workspace.getConfiguration('openspec');
      await config.update('preferredAgentAdapter', selected.id, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(t('adapter.switched', { name: selected.label }));
    } catch (error) {
      logger.error('Failed to select agent adapter', error as Error);
      vscode.window.showErrorMessage(t('adapter.selectFailed'));
    }
  }
}
