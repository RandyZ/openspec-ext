import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { reconcileSelectedOutputPath } from '../../../src/webview/components/ChangeDetail';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/webview/components/ChangeDetail.tsx'),
  'utf8'
);

describe('ChangeDetail workflow routing', () => {
  it('resets a removed selected output to the first current output', () => {
    const outputs = [
      { path: 'openspec/changes/demo/new.md', label: 'new.md', kind: 'markdown' as const },
      { path: 'openspec/changes/demo/other.md', label: 'other.md', kind: 'markdown' as const },
    ];

    expect(reconcileSelectedOutputPath('openspec/changes/demo/old.md', outputs))
      .toBe('openspec/changes/demo/new.md');
    expect(reconcileSelectedOutputPath('openspec/changes/demo/other.md', outputs))
      .toBe('openspec/changes/demo/other.md');
    expect(reconcileSelectedOutputPath('openspec/changes/demo/old.md', [])).toBeUndefined();
  });

  it('consumes the shared resolver and does not derive lifecycle actions locally', () => {
    expect(source).toContain('resolveWorkflowActions');
    expect(source).not.toContain('deriveWorkflowState');
    expect(source).not.toContain('WorkflowStepIndicator');
  });

  it('renders navigation groups from ordered snapshot artifact states', () => {
    expect(source).toContain('workflowSnapshot.artifacts');
    expect(source).toContain("t('detail.nav.available')");
    expect(source).toContain("t('detail.nav.blocked')");
    expect(source).toContain("t('detail.nav.skipped')");
    expect(source).not.toContain('const ALL_TABS');
  });

  it('routes Verify and Archive through the dedicated interactive tab', () => {
    expect(source).toContain("action === 'verify' || action === 'archive'");
    expect(source).toContain('setPendingInteractiveAction(action)');
    expect(source).toContain('onAction={handleResolvedAction}');
  });

  it('shows schema and bound planning context in the header', () => {
    expect(source).toContain("t('detail.schema'");
    expect(source).toContain("t('detail.project'");
    expect(source).toContain("t(scopeSource === 'store'");
  });

  it('keeps correlated receipt state local and ignores stale requests', () => {
    expect(source).toContain("msg.type === 'workflowActionReceipt'");
    expect(source).toContain('msg.bindingKey === workflowSnapshot.bindingKey');
    expect(source).toContain('workflowReceipt?.requestId === msg.requestId');
    expect(source).toContain('receiptStatus={workflowReceipt?.status}');
  });

  it('routes artifact create with AI through workflow launch instead of direct command manager calls', () => {
    expect(source).not.toContain('sendMessage.requestCreateArtifact');
    expect(source).toContain("handleLaunchWorkflow('continue')");
  });

  it('uses the Verify & Archive tab instead of the legacy verify-only tab', () => {
    expect(source).toContain("t('detail.verifyArchive')");
    expect(source).toContain("activeTab === 'verifyArchive'");
  });

  it('loads bound task progress before resolving Archive Now on the Verify & Archive tab', () => {
    expect(source).toContain("sendMessage.getArtifactContent(changeName, 'tasks', scopeId)");
  });

  it('keeps interactive review separate from resolver-gated direct archive', () => {
    expect(source).toContain('canArchiveNow');
    expect(source).toContain('onArchiveNow');
    expect(source).toContain('sendMessage.archiveChange(changeName, scopeId)');
    expect(source).toContain('runInteractiveWorkflow(changeName, action, scopeId)');

    const interactiveHandler = source.slice(
      source.indexOf('const handleResolvedAction'),
      source.indexOf('const handleConfirmTaskToggle')
    );
    expect(interactiveHandler).toContain('setPendingInteractiveAction(action)');
    expect(interactiveHandler).not.toContain('archiveChange');

    const panel = source.slice(
      source.indexOf('<VerifyArchivePanel'),
      source.indexOf('{debug &&')
    );
    expect(panel).toContain('onArchiveNow');
    expect(panel).toMatch(/onArchiveNow=\{handleArchiveNow\}/);
    expect(panel).not.toMatch(/onArchiveNow=\{[^}]*runInteractiveWorkflow/);
  });

  it('switches the detail view to archived read-only state after direct archive succeeds', () => {
    expect(source).toContain("const [archivedLocally, setArchivedLocally] = useState(false)");
    expect(source).toContain("msg.type === 'dashboardData'");
    expect(source).toContain('directArchivePending');
    expect(source).not.toMatch(/msg\.type === 'dashboardData'[\s\S]{0,180}&& directArchivePending/);
    expect(source).toMatch(/\[activeTab, changeName, directArchivePending, onMessage/);
    expect(source).toContain('setArchivedLocally(true)');
    expect(source).toContain('const isArchived = archivedLocally || changeName.startsWith(\'archive:\')');
    expect(source).not.toContain("msg.type === 'archiveCompleted'");
    expect(source).not.toContain("msg.type === 'archiveFailed'");
  });

  it('renders copy change name and removes show in sidebar from the detail header', () => {
    expect(source).not.toContain('handleShowInSidebar');
    expect(source).not.toContain("t('action.showInSidebar')");
    expect(source).toContain("t('action.copyChangeName')");
    expect(source).toContain('sendMessage.copyToClipboard(changeName)');
  });

  it('renders copy change name with stable accessible icon states', () => {
    expect(source).toContain("icon={copiedName ? 'check' : 'copy'}");
    expect(source).toContain("t('action.copyChangeName')");
    expect(source).toContain("t('action.copiedChangeName')");
  });

  it('keeps Open in Editor and Refresh in the detail header instead of ActionBar props', () => {
    expect(source).toContain('handleOpenInEditor');
    expect(source).toContain('handleRefresh');
    expect(source).not.toContain('onOpenInEditor={handleOpenInEditor}');
    expect(source).not.toContain('onRefresh={handleRefresh}');
  });
});
