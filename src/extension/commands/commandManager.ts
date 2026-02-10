import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { DashboardViewProvider } from '../providers/dashboardViewProvider';

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
      }
    } catch (error) {
      logger.error('Failed to open dashboard', error as Error);
      vscode.window.showErrorMessage('Failed to open OpenSpec dashboard');
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
          title: 'Refreshing OpenSpec data...',
          cancellable: false,
        },
        async () => {
          await this.dataManager.refresh();
        }
      );

      vscode.window.showInformationMessage('OpenSpec data refreshed');
    } catch (error) {
      logger.error('Failed to refresh data', error as Error);
      vscode.window.showErrorMessage('Failed to refresh OpenSpec data');
    }
  }

  /**
   * Create new change
   */
  private async handleNewChange(): Promise<void> {
    try {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter change name',
        placeHolder: 'e.g., add-authentication',
        validateInput: (value) => {
          if (!value) {
            return 'Change name is required';
          }
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Use lowercase letters, numbers, and hyphens only';
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
          title: `Creating change: ${name}...`,
          cancellable: false,
        },
        async () => {
          await this.dataManager.createChange(name);
        }
      );

      vscode.window.showInformationMessage(`Change "${name}" created`);
    } catch (error) {
      logger.error('Failed to create change', error as Error);
      vscode.window.showErrorMessage('Failed to create change');
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
          vscode.window.showInformationMessage('No changes to archive');
          return;
        }

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select change to archive',
        });

        if (!selected) {
          return;
        }

        changeName = selected.label;
      }

      // Confirm archive
      const confirm = await vscode.window.showWarningMessage(
        `Archive change "${changeName}"?`,
        { modal: true },
        'Archive'
      );

      if (confirm !== 'Archive') {
        return;
      }

      logger.info(`Archiving change: ${changeName}`);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Archiving change: ${changeName}...`,
          cancellable: false,
        },
        async () => {
          await this.dataManager.archiveChange(changeName!);
        }
      );

      vscode.window.showInformationMessage(`Change "${changeName}" archived`);
    } catch (error) {
      logger.error('Failed to archive change', error as Error);
      vscode.window.showErrorMessage('Failed to archive change');
    }
  }
}
