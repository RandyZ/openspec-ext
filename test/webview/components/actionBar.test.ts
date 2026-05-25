import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar } from '../../../src/webview/components/ActionBar';
import type { WorkflowState } from '../../../src/webview/utils/workflowState';
import type { WorkflowLaunchConfigView } from '../../../src/webview/utils/workflowLaunchLabels';

const workflowState: WorkflowState = {
  steps: [],
  currentStep: 'verify',
  nextAction: null,
  secondaryActions: [
    {
      label: 'Archive',
      action: 'archive',
      command: '/opsx:archive demo-change',
      variant: 'secondary',
    },
  ],
};

const launchConfig: WorkflowLaunchConfigView = {
  workflowLaunchMode: 'clipboard',
  preferredAgentAdapter: 'clipboard',
  cursorLaunchMode: 'clipboard',
  cursorAgentModel: 'auto',
  cursorLaunchModeExplicit: false,
  effectiveAdapterId: null,
};

function childrenOf(node: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(node);
}

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!React.isValidElement(node)) return '';
  return childrenOf(node.props.children).map(textOf).join('');
}

function findButtonByText(node: React.ReactNode, text: string): React.ReactElement {
  if (React.isValidElement(node)) {
    if (node.type === 'button' && textOf(node) === text) {
      return node;
    }
    for (const child of childrenOf(node.props.children)) {
      const found = findButtonByText(child, text);
      if (found) return found;
    }
  }
  throw new Error(`Button not found: ${text}`);
}

describe('ActionBar', () => {
  it('routes Archive through workflow action handling', () => {
    const onAction = vi.fn();
    const onArchive = vi.fn();

    const tree = ActionBar({
      changeName: 'demo-change',
      isArchived: false,
      workflowState,
      workflowLaunchConfig: launchConfig,
      onAction,
      onCopyFf: vi.fn(),
      onCopyApply: vi.fn(),
      onOpenInEditor: vi.fn(),
      onArchive,
      onRefresh: vi.fn(),
    });

    const archiveButton = findButtonByText(tree, 'Copy Archive');
    archiveButton.props.onClick();

    expect(onAction).toHaveBeenCalledWith('archive', 'demo-change');
    expect(onArchive).not.toHaveBeenCalled();
  });
});
