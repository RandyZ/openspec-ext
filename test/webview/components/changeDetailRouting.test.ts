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
});
