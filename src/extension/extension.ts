import * as vscode from 'vscode';
import { initLogger, logger } from './utils/logger';
import { getOpenSpecWorkspaceRoot, getOpenSpecProjectRoots } from './utils/workspaceRoot';
import { DataManager } from './services/dataManager';
import { CommandManager } from './commands/commandManager';
import { DashboardViewProvider } from './providers/dashboardViewProvider';
import { ChangeDetailPanelManager } from './providers/changeDetailPanelManager';
import { InteractiveAgentTerminalManager } from './services/interactiveAgentTerminalManager';
import { OpenSpecCacheService } from './services/openSpecCacheService';
import { setLocale, t } from '../i18n';

let dataManager: DataManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
  initLogger();
  const detectedLocale = vscode.env.language;
  setLocale(detectedLocale);
  logger.info(`OpenSpec extension is activating... (locale: ${detectedLocale})`);

  try {
    const workspaceRoot = await getOpenSpecWorkspaceRoot();
    if (!workspaceRoot) {
      logger.error('No workspace folder found');
      vscode.window.showErrorMessage(t('extension.noWorkspace'));
      return;
    }
    logger.info(`[archived] activate: using workspaceRoot=${workspaceRoot}`);

    // Discover ALL OpenSpec project roots so multi-folder workspaces expose every
    // project (e.g. FastGPT + Server_DotNetCore) in the root selector. The
    // activation root stays the 'local' scope; additional roots become 'declared'.
    const projectRoots = await getOpenSpecProjectRoots();

    // Initialize data manager
    const cacheService = new OpenSpecCacheService(context.globalStorageUri, {
      workspaceRoot,
      extensionVersion: context.extension.packageJSON.version ?? '0.0.0',
    });
    dataManager = new DataManager(workspaceRoot, { cacheService, projectRoots });
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
    const interactiveTerminalManager = new InteractiveAgentTerminalManager();
    context.subscriptions.push(interactiveTerminalManager);

    const changeDetailPanelManager = new ChangeDetailPanelManager(
      dataManager,
      context.extensionPath,
      interactiveTerminalManager,
      onAfterOpenChangeDetail,
      onRevealSidebar
    );

    // Register dashboard view provider (sidebar)
    const dashboardViewProvider = new DashboardViewProvider(
      dataManager,
      context.extensionPath,
      changeDetailPanelManager,
      interactiveTerminalManager
    );
    dashboardViewProviderRef = dashboardViewProvider;
    logger.info(`Registering dashboard webview provider: ${DashboardViewProvider.viewType}`);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        DashboardViewProvider.viewType,
        dashboardViewProvider
      )
    );

    // Subscribe to artifact-level changes so open panels can invalidate their caches
    context.subscriptions.push(
      dataManager.onArtifactChanged(({ changeName, artifactTypes }) => {
        changeDetailPanelManager.notifyArtifactChanged(changeName, artifactTypes);
      })
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        const launchConfigChanged =
          event.affectsConfiguration('openspec.workflowLaunchMode') ||
          event.affectsConfiguration('openspec.preferredAgentAdapter') ||
          event.affectsConfiguration('openspec.cursorLaunchMode') ||
          event.affectsConfiguration('openspec.cursorAgentModel');
        if (!launchConfigChanged) return;
        logger.info('[workflow] launch configuration changed; updating webviews');
        dashboardViewProvider.postWorkflowLaunchConfig();
        changeDetailPanelManager.postWorkflowLaunchConfig();
      })
    );

    // Register commands
    const commandManager = new CommandManager(dataManager, context, dashboardViewProvider);
    commandManager.register();

    logger.info('OpenSpec extension activated successfully');
    console.log('OpenSpec extension is now active!');
    await promptReloadAfterInstallOrUpdate(context);
  } catch (error) {
    logger.error('Failed to activate OpenSpec extension', error as Error);
    vscode.window.showErrorMessage(
      `OpenSpec extension failed to activate: ${(error as Error).message}`
    );
  }
}

async function promptReloadAfterInstallOrUpdate(context: vscode.ExtensionContext): Promise<void> {
  const packageVersion = String(context.extension.packageJSON?.version ?? 'unknown');
  const marker = `${packageVersion}:${DashboardViewProvider.viewType}`;
  const key = 'openspec.installationMarker';
  const previous = context.globalState.get<string>(key);
  if (previous === marker) return;

  await context.globalState.update(key, marker);
  logger.info(`OpenSpec installation marker changed: previous=${previous ?? 'none'}, current=${marker}`);
  const reload = t('extension.reloadWindow');
  const selected = await vscode.window.showInformationMessage(
    t('extension.reloadRecommended'),
    reload
  );
  if (selected === reload) {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
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
