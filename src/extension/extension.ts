import * as vscode from 'vscode';
import { initLogger, logger } from './utils/logger';
import { getOpenSpecWorkspaceRoot } from './utils/workspaceRoot';
import { DataManager } from './services/dataManager';
import { CommandManager } from './commands/commandManager';
import { DashboardViewProvider } from './providers/dashboardViewProvider';
import { ChangeDetailPanelManager } from './providers/changeDetailPanelManager';

let dataManager: DataManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
  initLogger();
  logger.info('OpenSpec extension is activating...');

  try {
    const workspaceRoot = await getOpenSpecWorkspaceRoot();
    if (!workspaceRoot) {
      logger.error('No workspace folder found');
      vscode.window.showErrorMessage('OpenSpec: No workspace folder found');
      return;
    }

    // Initialize data manager
    dataManager = new DataManager(workspaceRoot);
    await dataManager.initialize();

    let dashboardViewProviderRef: DashboardViewProvider | null = null;
    const onAfterOpenChangeDetail = (): void => {
      if (vscode.workspace.getConfiguration('openspec').get<boolean>('focusSidebarViewWhenOpeningChangeDetail')) {
        dashboardViewProviderRef?.reveal();
      }
    };
    const onRevealSidebar = (): void => {
      dashboardViewProviderRef?.reveal();
    };

    const changeDetailPanelManager = new ChangeDetailPanelManager(
      dataManager,
      context.extensionPath,
      onAfterOpenChangeDetail,
      onRevealSidebar
    );

    // Register dashboard view provider (sidebar)
    const dashboardViewProvider = new DashboardViewProvider(
      dataManager,
      context.extensionPath,
      changeDetailPanelManager
    );
    dashboardViewProviderRef = dashboardViewProvider;
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        DashboardViewProvider.viewType,
        dashboardViewProvider
      )
    );

    // Register commands
    const commandManager = new CommandManager(dataManager, context, dashboardViewProvider);
    commandManager.register();

    logger.info('OpenSpec extension activated successfully');
    console.log('OpenSpec extension is now active!');
  } catch (error) {
    logger.error('Failed to activate OpenSpec extension', error as Error);
    vscode.window.showErrorMessage(
      `OpenSpec extension failed to activate: ${(error as Error).message}`
    );
  }
}

export function deactivate() {
  logger.info('OpenSpec extension is deactivating');
  
  if (dataManager) {
    dataManager.dispose();
    dataManager = null;
  }

  logger.dispose();
  console.log('OpenSpec extension is now deactivated');
}
