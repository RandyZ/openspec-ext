import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar } from '../../../src/webview/components/ActionBar';
import type { WorkflowState } from '../../../src/webview/utils/workflowState';
import type { WorkflowLaunchConfigView } from '../../../src/webview/utils/workflowLaunchLabels';

const workflowState: WorkflowState = {
  steps: [],
  currentStep: 'verify',
  nextAction: null,
  secondaryActions: [],
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
  it('does not render verify/archive top actions once the dedicated tab owns them', () => {
    const onAction = vi.fn();

    const tree = ActionBar({
      changeName: 'demo-change',
      isArchived: false,
      workflowState,
      workflowLaunchConfig: launchConfig,
      onAction,
      onCopyFf: vi.fn(),
      onCopyApply: vi.fn(),
      onOpenInEditor: vi.fn(),
      onArchive: vi.fn(),
      onRefresh: vi.fn(),
    });

    expect(() => findButtonByText(tree, 'Copy Archive')).toThrow();
    expect(() => findButtonByText(tree, 'Run Agent Archive')).toThrow();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('does not render workspace utilities in the workflow action bar', () => {
    const tree = ActionBar({
      changeName: 'demo-change',
      isArchived: false,
      workflowState: {
        steps: [],
        currentStep: 'apply',
        nextAction: {
          label: 'Apply',
          action: 'apply',
          command: '/opsx:apply demo-change',
          variant: 'primary',
        },
        secondaryActions: [],
      },
      workflowLaunchConfig: launchConfig,
      onAction: vi.fn(),
      onCopyFf: vi.fn(),
      onCopyApply: vi.fn(),
      onOpenInEditor: vi.fn(),
      onArchive: vi.fn(),
      onRefresh: vi.fn(),
    });

    expect(() => findButtonByText(tree, 'Open in Editor')).toThrow();
    expect(() => findButtonByText(tree, 'Refresh')).toThrow();
    expect(findButtonByText(tree, 'Copy Apply')).toBeTruthy();
  });
});
