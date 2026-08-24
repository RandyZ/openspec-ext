import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar } from '../../../src/webview/components/ActionBar';
import type { WorkflowState } from '../../../src/webview/utils/workflowState';
import type { WorkflowLaunchConfigView } from '../../../src/webview/utils/workflowLaunchLabels';
import type { ResolvedWorkflowActions } from '../../../src/shared/changeWorkflow';

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
  it('renders one recommended action and separates high-impact alternatives', () => {
    const resolvedActions: ResolvedWorkflowActions = {
      recommended: { action: 'verify', label: 'Verify', variant: 'primary', highImpact: true },
      available: [{ action: 'sync', label: 'Sync Specs', variant: 'secondary' }],
      highImpact: [{ action: 'archive', label: 'Archive', variant: 'secondary', highImpact: true }],
      blocked: [],
      skipped: [],
      attentionReasons: [],
    };
    const tree = ActionBar({
      changeName: 'demo-change',
      isArchived: false,
      resolvedActions,
      workflowLaunchConfig: launchConfig,
      onAction: vi.fn(),
      onCopyFf: vi.fn(),
      onCopyApply: vi.fn(),
    });

    expect(findButtonByText(tree, 'Copy Verify')).toBeTruthy();
    expect(textOf(tree)).toContain('Copy Sync Specs');
    expect(textOf(tree)).toContain('Copy Archive');
  });

  it('disables only the matching pending action and exposes the receipt status', () => {
    const tree = ActionBar({
      changeName: 'demo-change',
      isArchived: false,
      resolvedActions: {
        recommended: { action: 'apply', label: 'Apply', variant: 'primary' },
        available: [{ action: 'ff', label: 'FF', variant: 'secondary' }],
        highImpact: [],
        blocked: [],
        skipped: [],
        attentionReasons: [],
      },
      pendingAction: 'apply',
      receiptStatus: 'pending',
      receiptMessage: 'Waiting',
      onAction: vi.fn(),
      onCopyFf: vi.fn(),
      onCopyApply: vi.fn(),
    });

    const buttons: React.ReactElement[] = [];
    const visit = (node: React.ReactNode) => {
      if (!React.isValidElement(node)) return;
      if (node.type === 'button') buttons.push(node);
      childrenOf(node.props.children).forEach(visit);
    };
    visit(tree);
    expect(buttons.find((button) => textOf(button).includes('Apply'))?.props.disabled).toBe(true);
    expect(buttons.find((button) => textOf(button).includes('FF'))?.props.disabled).toBe(false);
    expect(textOf(tree)).toContain('Pending: Waiting');
  });

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
