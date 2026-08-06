import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const source = readFileSync(
  path.resolve(__dirname, '../../../src/webview/components/ChangeDetail.tsx'),
  'utf8'
);

describe('ChangeDetail workflow routing', () => {
  it('routes artifact create with AI through workflow launch instead of direct command manager calls', () => {
    expect(source).not.toContain('sendMessage.requestCreateArtifact');
    expect(source).toContain("handleLaunchWorkflow('continue')");
  });

  it('uses the Verify & Archive tab instead of the legacy verify-only tab', () => {
    expect(source).toContain('VERIFY_ARCHIVE_TAB_ID');
    expect(source).toContain('activeTab === VERIFY_ARCHIVE_TAB_ID');
    expect(source).toContain('buildTabs');
  });

  it('renders Other Artifacts strip with openOtherArtifact click handler', () => {
    expect(source).toContain('data-testid="other-artifacts"');
    expect(source).toContain("t('artifact.otherArtifacts')");
    expect(source).toContain("t('artifact.otherArtifactDirLabel'");
    expect(source).toContain('sendMessage.openOtherArtifact(changeName, entry.id, scopeId)');
    expect(source).toContain('otherArtifacts.length > 0');
  });

  it('does not use direct archiveChange from the detail action bar', () => {
    expect(source).not.toContain('sendMessage.archiveChange');
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
