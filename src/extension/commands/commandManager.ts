import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { DataManager } from '../services/dataManager';
import { DashboardViewProvider } from '../providers/dashboardViewProvider';
import { getAvailableAdapters, getCurrentAdapter } from '../adapters';

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
        ? `已复制命令，请在 AI 对话中粘贴以生成 ${artifactLabel}`
        : '已复制 /opsx:continue，请在 AI 对话中粘贴以生成对应 artifact'
    );
  }

  private buildContinuePrompt(changeName: string | undefined, artifactType: string | undefined): string {
    const base = changeName ? `/opsx:continue ${changeName}` : '/opsx:continue';
    if (!changeName || !artifactType) return base;
    switch (artifactType) {
      case 'proposal':
        return `${base}\n请创建 Proposal artifact（change 的需求提案文档）`;
      case 'specs':
        return `${base}\n请创建 Specs artifacts（基于 Proposal 的功能规格文档）`;
      case 'design':
        return `${base}\n请创建 Design artifact（基于 Proposal 的技术设计文档）`;
      case 'tasks':
        return `${base}\n请创建 Tasks artifact（基于 Specs 和 Design 的实施任务清单）`;
      default:
        return base;
    }
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
        vscode.window.showInformationMessage('当前没有可用的执行者。');
        return;
      }
      const current = await getCurrentAdapter();
      const items = available.map((a) => ({
        label: a.displayName,
        description: a.id === current?.id ? '当前' : undefined,
        id: a.id,
      }));
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择任务执行者',
        matchOnDescription: true,
      });
      if (!selected) return;
      const config = vscode.workspace.getConfiguration('openspec');
      await config.update('preferredAgentAdapter', selected.id, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`已切换执行者: ${selected.label}`);
    } catch (error) {
      logger.error('Failed to select agent adapter', error as Error);
      vscode.window.showErrorMessage('选择执行者失败');
    }
  }
}
