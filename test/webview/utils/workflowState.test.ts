import { describe, it, expect } from 'vitest';
import {
  deriveWorkflowState,
  getNextArtifact,
  getStepLabel,
} from '../../../src/webview/utils/workflowState';

describe('getStepLabel', () => {
  it('returns human-readable labels', () => {
    expect(getStepLabel('proposal')).toBe('Proposal');
    expect(getStepLabel('verify')).toBe('Verify');
    expect(getStepLabel('archive')).toBe('Archive');
  });
});

describe('getNextArtifact', () => {
  it('returns proposal when no artifacts exist', () => {
    expect(getNextArtifact(undefined)).toBe('proposal');
    expect(getNextArtifact([])).toBe('proposal');
  });

  it('returns specs when proposal exists', () => {
    expect(getNextArtifact(['proposal'])).toBe('specs');
  });

  it('returns design when proposal+specs exist', () => {
    expect(getNextArtifact(['proposal', 'specs'])).toBe('design');
  });

  it('returns tasks when proposal+specs+design exist', () => {
    expect(getNextArtifact(['proposal', 'specs', 'design'])).toBe('tasks');
  });

  it('returns null when all artifacts exist', () => {
    expect(getNextArtifact(['proposal', 'specs', 'design', 'tasks'])).toBeNull();
  });
});

describe('deriveWorkflowState', () => {
  const name = 'test-change';

  it('archived change: all steps done, no actions', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs', 'design', 'tasks'], 5, 5, true, false);
    expect(state.currentStep).toBe('archive');
    expect(state.nextAction).toBeNull();
    expect(state.secondaryActions).toHaveLength(0);
    expect(state.steps.every((s) => s.status === 'done')).toBe(true);
  });

  it('empty draft: current=proposal, primary=Continue → Proposal', () => {
    const state = deriveWorkflowState(name, [], 0, 0, false, false);
    expect(state.currentStep).toBe('proposal');
    expect(state.nextAction?.label).toBe('Continue → Proposal');
    expect(state.nextAction?.command).toBe('/opsx:continue test-change');
    expect(state.secondaryActions.some((a) => a.label === 'FF')).toBe(true);
  });

  it('has proposal only: current=specs, primary=Continue → Specs', () => {
    const state = deriveWorkflowState(name, ['proposal'], 0, 0, false, false);
    expect(state.currentStep).toBe('specs');
    expect(state.nextAction?.label).toBe('Continue → Specs');
    expect(state.steps.find((s) => s.step === 'proposal')?.status).toBe('done');
  });

  it('has proposal+specs: current=design', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs'], 0, 0, false, false);
    expect(state.currentStep).toBe('design');
    expect(state.nextAction?.label).toBe('Continue → Design');
  });

  it('has proposal+design but no specs: current=specs', () => {
    const state = deriveWorkflowState(name, ['proposal', 'design'], 0, 0, false, false);
    expect(state.currentStep).toBe('specs');
  });

  it('all artifacts, tasks incomplete: current=apply', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs', 'design', 'tasks'], 3, 5, false, false);
    expect(state.currentStep).toBe('apply');
    expect(state.nextAction?.label).toBe('Apply');
    expect(state.nextAction?.command).toBe('/opsx:apply test-change');
    expect(state.secondaryActions.some((a) => a.label === 'Verify')).toBe(true);
  });

  it('all tasks done: current=verify', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs', 'design', 'tasks'], 5, 5, false, false);
    expect(state.currentStep).toBe('verify');
    expect(state.nextAction?.label).toBe('Verify');
    expect(state.nextAction?.command).toBe('/opsx:verify test-change');
    expect(state.secondaryActions.some((a) => a.label === 'Archive')).toBe(true);
  });

  it('hasDeltaSpecs adds Sync Specs secondary action', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs', 'design', 'tasks'], 3, 5, false, true);
    expect(state.secondaryActions.some((a) => a.label === 'Sync Specs')).toBe(true);
    expect(state.secondaryActions.find((a) => a.label === 'Sync Specs')?.command).toBe(
      '/opsx:sync test-change'
    );
  });

  it('FF secondary action present when artifacts are missing', () => {
    const state = deriveWorkflowState(name, ['proposal'], 0, 0, false, false);
    const ff = state.secondaryActions.find((a) => a.label === 'FF');
    expect(ff).toBeDefined();
    expect(ff?.command).toBe('/opsx:ff test-change');
  });

  it('FF secondary action absent when all artifacts exist', () => {
    const state = deriveWorkflowState(name, ['proposal', 'specs', 'design', 'tasks'], 0, 5, false, false);
    expect(state.secondaryActions.some((a) => a.label === 'FF')).toBe(false);
  });
});
