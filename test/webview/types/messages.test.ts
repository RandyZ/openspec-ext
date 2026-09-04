import { describe, expect, it } from 'vitest';
import { sendMessage } from '../../../src/webview/types/messages';
import type { ExtensionMessage, WebviewMessage } from '../../../src/webview/types/messages';

/** Compile-time guard: every asserted payload must be a valid WebviewMessage union member. */
function asWebviewMessage(message: WebviewMessage): WebviewMessage {
  return message;
}

/** Compile-time guard: every asserted payload must be a valid ExtensionMessage union member. */
function asExtensionMessage(message: ExtensionMessage): ExtensionMessage {
  return message;
}

describe('sendMessage workset creation contract', () => {
  it('pickWorksetMembers produces a payload-free discriminator message', () => {
    const message = asWebviewMessage(sendMessage.pickWorksetMembers());

    expect(message).toStrictEqual({ type: 'pickWorksetMembers' });
    expect(Object.keys(message)).toStrictEqual(['type']);
  });

  it('createWorkset carries name and members in order without tool when omitted', () => {
    const message = asWebviewMessage(sendMessage.createWorkset('platform', ['/work/primary', '/stores/team-plans']));

    expect(message).toStrictEqual({
      type: 'createWorkset',
      name: 'platform',
      members: ['/work/primary', '/stores/team-plans'],
    });
    expect(message).not.toHaveProperty('tool');
  });

  it('createWorkset includes the one-time tool only when provided', () => {
    const message = asWebviewMessage(sendMessage.createWorkset('platform', ['/work/primary'], 'cursor'));

    expect(message).toStrictEqual({
      type: 'createWorkset',
      name: 'platform',
      members: ['/work/primary'],
      tool: 'cursor',
    });
    expect(message).toHaveProperty('tool', 'cursor');
  });

  it('openWorkset omits tool when not provided', () => {
    const message = asWebviewMessage(sendMessage.openWorkset('platform'));

    expect(message).toStrictEqual({ type: 'openWorkset', name: 'platform' });
    expect(message).not.toHaveProperty('tool');
  });

  it('openWorkset carries the one-time tool override when provided', () => {
    const message = asWebviewMessage(sendMessage.openWorkset('platform', 'cursor'));

    expect(message).toStrictEqual({ type: 'openWorkset', name: 'platform', tool: 'cursor' });
    expect(message).not.toHaveProperty('members');
  });

  it('selectWorksetStore carries the workset name and member path', () => {
    const message = asWebviewMessage(sendMessage.selectWorksetStore('platform', '/stores/team-plans'));

    expect(message).toStrictEqual({
      type: 'selectWorksetStore',
      worksetName: 'platform',
      memberPath: '/stores/team-plans',
    });
  });

  it('selectProjectDefaultRoot produces a payload-free discriminator message', () => {
    const message = asWebviewMessage(sendMessage.selectProjectDefaultRoot());

    expect(message).toStrictEqual({ type: 'selectProjectDefaultRoot' });
    expect(Object.keys(message)).toStrictEqual(['type']);
  });
});

describe('ExtensionMessage workset result contract', () => {
  it('worksetMembersPicked carries the picked folder paths verbatim', () => {
    const message = asExtensionMessage({
      type: 'worksetMembersPicked',
      paths: ['/work/primary', '/stores/team-plans'],
    });

    expect(message).toStrictEqual({
      type: 'worksetMembersPicked',
      paths: ['/work/primary', '/stores/team-plans'],
    });
    expect(Object.keys(message)).toStrictEqual(['type', 'paths']);
  });

  it('worksetMembersPicked optionally carries Host-dropped unrealpath-able paths', () => {
    const message = asExtensionMessage({
      type: 'worksetMembersPicked',
      paths: ['/work/primary'],
      droppedPaths: ['/work/gone'],
    });

    expect(message).toStrictEqual({
      type: 'worksetMembersPicked',
      paths: ['/work/primary'],
      droppedPaths: ['/work/gone'],
    });
    // The optional field keeps older payloads (and senders) unaffected.
    const legacy = asExtensionMessage({ type: 'worksetMembersPicked', paths: [] });
    expect('droppedPaths' in legacy).toBe(false);
  });

  it('worksetCreateResult success carries name without a message field', () => {
    const message = asExtensionMessage({
      type: 'worksetCreateResult',
      success: true,
      name: 'platform',
    });

    expect(message).toStrictEqual({ type: 'worksetCreateResult', success: true, name: 'platform' });
    expect(message).not.toHaveProperty('message');
  });

  it('worksetCreateResult failure carries the diagnostic message', () => {
    const message = asExtensionMessage({
      type: 'worksetCreateResult',
      success: false,
      name: 'platform',
      message: 'workset create failed',
    });

    expect(message).toStrictEqual({
      type: 'worksetCreateResult',
      success: false,
      name: 'platform',
      message: 'workset create failed',
    });
  });
});

describe('workset message union discrimination', () => {
  it('narrows openWorkset messages on type without touching setContext paths', () => {
    const message: WebviewMessage = sendMessage.openWorkset('platform', 'cursor');

    if (message.type === 'openWorkset') {
      expect(message.name).toBe('platform');
      expect(message.tool).toBe('cursor');
    } else {
      throw new Error(`unexpected message type: ${(message as { type: string }).type}`);
    }
  });

  it('narrows createWorkset messages on type', () => {
    const message: WebviewMessage = sendMessage.createWorkset('platform', ['/work/primary']);

    if (message.type === 'createWorkset') {
      expect(message.name).toBe('platform');
      expect(message.members).toStrictEqual(['/work/primary']);
      expect(message.tool).toBeUndefined();
    } else {
      throw new Error(`unexpected message type: ${(message as { type: string }).type}`);
    }
  });

  it('narrows worksetMembersPicked and worksetCreateResult on type', () => {
    const membersPicked: ExtensionMessage = { type: 'worksetMembersPicked', paths: [] };
    if (membersPicked.type === 'worksetMembersPicked') {
      expect(membersPicked.paths).toStrictEqual([]);
    } else {
      throw new Error('unexpected message type');
    }

    const createResult: ExtensionMessage = {
      type: 'worksetCreateResult',
      success: true,
      name: 'platform',
    };
    if (createResult.type === 'worksetCreateResult') {
      expect(createResult.success).toBe(true);
      expect(createResult.name).toBe('platform');
      expect(createResult.message).toBeUndefined();
    } else {
      throw new Error('unexpected message type');
    }
  });
});
