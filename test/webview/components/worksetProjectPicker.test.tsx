import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../src/i18n';
import {
  WorksetOneTimeOpenerForm,
  WorksetProjectPicker,
  backToWorksetListScene,
  formatWorksetMemberGitLabel,
  isWorksetOpenerEditorOpen,
  mergePickedWorksetMembers,
  normalizeOneTimeOpenerTool,
  normalizeWorksetCreateSubmit,
  openWorksetCreateScene,
  openWorksetDetailScene,
  promoteWorksetPrimaryMember,
  reconcileWorksetPickerResponses,
  removeWorksetDraftMember,
  resetWorksetPickerSelectionForProject,
  resolveWorksetPickerScene,
  runWorksetCreateSubmit,
  runWorksetOpenAction,
  worksetDetailHeadingId,
  worksetPickerProjectKey,
  type WorksetCreateDraft,
} from '../../../src/webview/components/WorksetProjectPicker';
import type { ProjectWorksetNavigationData } from '../../../src/webview/types/messages';

const current = {
  id: '/projects/current',
  label: 'Current Project',
  projectPath: '/projects/current',
};

const docsWorktreeMember = {
  name: 'Docs Worktree',
  path: '/repos/docs-worktree',
  role: 'project' as const,
  selectable: true,
  project: {
    id: '/repos/docs-worktree',
    label: 'Docs Worktree',
    projectPath: '/repos/docs-worktree',
  },
  git: { repository: '/repos/docs', branch: 'feature/docs' },
};

const navigation: ProjectWorksetNavigationData = {
  project: current,
  worksets: [
    {
      name: 'planning',
      tool: 'vscode',
      members: [
        {
          name: current.label,
          path: current.projectPath,
          role: 'project' as const,
          selectable: true,
          project: current,
        },
        docsWorktreeMember,
        {
          name: 'team-plans',
          path: '/stores/team-plans',
          role: 'store' as const,
          selectable: false,
          storeId: 'team-plans',
        },
      ],
    },
    {
      name: 'solo',
      members: [
        {
          name: current.label,
          path: current.projectPath,
          role: 'project' as const,
          selectable: true,
          project: current,
        },
      ],
    },
  ],
};

function renderPicker(
  overrides: {
    navigation?: ProjectWorksetNavigationData;
    initialScene?: Parameters<typeof WorksetProjectPicker>[0]['initialScene'];
    initialOpenerOpen?: boolean;
    activeStoreId?: string;
    explicitStoreSelector?: boolean;
    createAvailable?: boolean;
    pickedMembers?: Parameters<typeof WorksetProjectPicker>[0]['pickedMembers'];
    createResult?: Parameters<typeof WorksetProjectPicker>[0]['createResult'];
  } = {},
) {
  return renderToStaticMarkup(
    <WorksetProjectPicker
      navigation={overrides.navigation ?? navigation}
      initialScene={overrides.initialScene}
      initialOpenerOpen={overrides.initialOpenerOpen}
      activeStoreId={overrides.activeStoreId}
      explicitStoreSelector={overrides.explicitStoreSelector}
      createAvailable={overrides.createAvailable}
      pickedMembers={overrides.pickedMembers}
      createResult={overrides.createResult}
      onSelectProject={vi.fn()}
      onSelectWorksetStore={vi.fn()}
      onSelectProjectDefaultRoot={vi.fn()}
      onOpenWorkset={vi.fn()}
      onPickMembers={vi.fn()}
      onCreateWorkset={vi.fn()}
      onBackToCurrentProject={vi.fn()}
    />,
  );
}

describe('WorksetProjectPicker scene state machine', () => {
  it('selects a detail scene by official Workset name and returns locally on Back', () => {
    expect(openWorksetDetailScene('planning')).toEqual({ kind: 'detail', name: 'planning' });
    expect(backToWorksetListScene()).toEqual({ kind: 'list' });
  });

  it('keeps detail across a same-Project refresh while the Workset still exists', () => {
    const scene = openWorksetDetailScene('planning');
    const projectKey = worksetPickerProjectKey(navigation.project);
    // Same reference means "no reset": an ordinary snapshot refresh (including a
    // binding-only refresh that produces a new navigation object) keeps the detail.
    expect(resolveWorksetPickerScene(scene, projectKey, navigation)).toBe(scene);
    expect(
      resolveWorksetPickerScene(scene, projectKey, {
        ...navigation,
        worksets: [...navigation.worksets],
      }),
    ).toBe(scene);
  });

  it('returns to the list with a recoverable notice when the selected Workset disappears', () => {
    const scene = openWorksetDetailScene('planning');
    const refreshed: ProjectWorksetNavigationData = { ...navigation, worksets: [navigation.worksets[1]] };
    expect(
      resolveWorksetPickerScene(scene, worksetPickerProjectKey(navigation.project), refreshed),
    ).toEqual({ kind: 'list', staleDetailName: 'planning' });
  });

  it('resets to the plain list without a stale notice when Project identity changes', () => {
    const scene = openWorksetDetailScene('planning');
    const otherProject: ProjectWorksetNavigationData = {
      ...navigation,
      project: { ...current, id: '/projects/other', projectPath: '/projects/other' },
    };
    expect(
      resolveWorksetPickerScene(scene, worksetPickerProjectKey(navigation.project), otherProject),
    ).toEqual({ kind: 'list' });
  });

  it('commits the Project identity reset so returning to a previous Project cannot revive its detail', () => {
    // The reset must be persistent state, not a per-render derivation:
    // A -> B -> A must land on the plain list with a closed opener editor.
    const selection = {
      projectKey: worksetPickerProjectKey(current),
      scene: openWorksetDetailScene('planning'),
      openerEditor: { worksetName: 'planning' },
    };
    const projectBKey = worksetPickerProjectKey({ ...current, id: '/projects/other', projectPath: '/projects/other' });

    const reset = resetWorksetPickerSelectionForProject(selection, projectBKey);
    expect(reset).toEqual({
      projectKey: projectBKey,
      scene: { kind: 'list' },
      openerEditor: null,
    });
    // The committed reset means navigating back to A keeps the plain list.
    const backToA = resetWorksetPickerSelectionForProject(reset, selection.projectKey);
    expect(backToA).toEqual({
      projectKey: selection.projectKey,
      scene: { kind: 'list' },
      openerEditor: null,
    });
    // Same Project identity keeps the persisted selection untouched.
    expect(resetWorksetPickerSelectionForProject(selection, selection.projectKey)).toBe(selection);
  });
});

describe('WorksetProjectPicker one-time opener editor lifetime', () => {
  it('derives the editor open state from the current detail target', () => {
    const editor = { worksetName: 'planning' };
    expect(isWorksetOpenerEditorOpen(editor, 'planning')).toBe(true);
    // A different detail target (Workset B after Back) keeps the editor closed.
    expect(isWorksetOpenerEditorOpen(editor, 'solo')).toBe(false);
    // Leaving the detail scene (list reset) closes the editor and discards the
    // typed id by unmounting the form.
    expect(isWorksetOpenerEditorOpen(editor, undefined)).toBe(false);
    expect(isWorksetOpenerEditorOpen(null, 'planning')).toBe(false);
  });
});

describe('WorksetProjectPicker list scene', () => {
  it('renders collapsed Workset rows without member rows until a Workset is selected', () => {
    const html = renderPicker();

    expect(html).toContain('data-workset-scene="list"');
    expect(html).toContain('data-workset-row="planning"');
    expect(html).toContain('data-workset-row="solo"');
    expect(html).toContain('3 members');
    expect(html).toContain('vscode');
    // Member rows MUST stay collapsed in the list scene.
    expect(html).not.toContain('data-workset-project=');
    expect(html).not.toContain('data-workset-store=');
    expect(html).not.toContain('Docs Worktree');
    expect(html).not.toContain('team-plans');
  });

  it('keeps a separate accessible whole-Workset open control outside the row body', () => {
    const html = renderPicker();

    expect(html).toContain('data-action="open-workset"');
    expect(html).toContain('aria-label="Open Whole Workset planning"');
    expect(html).toContain('title="Open Whole Workset planning"');
    // Row body activation and the Open control are separate focusable elements:
    // the open control must not live inside the row-body button markup.
    const rowStart = html.indexOf('data-workset-row="planning"');
    const rowEnd = html.indexOf('</button>', rowStart);
    expect(rowStart).toBeGreaterThan(-1);
    expect(rowEnd).toBeGreaterThan(rowStart);
    expect(html.slice(rowStart, rowEnd)).not.toContain('data-action="open-workset"');
  });

  it('keeps the picker separate from the Project content scene and exposes a keyboard-safe return', () => {
    const html = renderPicker();

    expect(html).toContain('data-workset-project-picker');
    expect(html).toContain('data-workset-picker-scene');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Return to Current Project"');
    expect(html).toContain('title="Return to Current Project"');
    expect(html).toContain('min-w-0');
    expect(html).toContain('truncate');
  });

  it('bounds long Workset labels while keeping every row keyboard-focusable', () => {
    const longNavigation: ProjectWorksetNavigationData = {
      ...navigation,
      project: { ...current, label: 'A very long current Project label that must remain bounded' },
      worksets: [{
        ...navigation.worksets[0],
        name: 'A very long Workset label that must remain bounded',
      }],
    };
    const html = renderPicker({ navigation: longNavigation });

    expect(html).toContain('A very long Workset label');
    expect(html).toContain('truncate');
    expect(html).toContain('type="button"');
    expect(html).toContain('focus-visible:outline-[var(--vscode-focusBorder)]');
  });
});

describe('WorksetProjectPicker detail scene', () => {
  const renderDetail = (
    initialScene: Parameters<typeof WorksetProjectPicker>[0]['initialScene'] = { kind: 'detail', name: 'planning' },
    nav: ProjectWorksetNavigationData = navigation,
  ) => renderPicker({ initialScene, navigation: nav });

  it('shows the Workset name, opener info, members, and a local Back control', () => {
    const html = renderDetail();

    expect(html).toContain('data-workset-scene="detail"');
    expect(html).toContain('data-workset-detail="planning"');
    expect(html).toContain('data-action="back-to-worksets"');
    expect(html).toContain('aria-label="Back to Worksets"');
    expect(html).toContain('Saved tool: vscode');
    expect(html).toContain('Docs Worktree');
    expect(html).toContain('feature/docs');
    expect(html).toContain('Planning Store');
    expect(html).not.toContain('data-workset-stale-notice');
    expect(html).not.toContain('data-workset-row=');
  });

  it('shows the default opener info when no tool is saved', () => {
    const html = renderDetail({ kind: 'detail', name: 'solo' });

    expect(html).toContain('data-workset-detail="solo"');
    expect(html).toContain('Default opener');
    expect(html).not.toContain('Saved tool:');
  });

  it('marks the current Project member as a state text, not a disabled action', () => {
    const html = renderDetail();

    expect(html).toContain('data-workset-member-state="current"');
    expect(html).toContain('>Current<');
    // The current member row carries no button control of its own.
    const currentIdx = html.indexOf('data-workset-member-state="current"');
    const rowStart = html.lastIndexOf('<div', currentIdx);
    const rowEnd = html.indexOf('</div>', currentIdx);
    expect(html.slice(rowStart, rowEnd)).not.toContain('<button');
    expect(html.slice(rowStart, rowEnd)).not.toContain('disabled');
  });

  it('falls back to the list with a recoverable notice when the detail Workset vanished', () => {
    const html = renderDetail({ kind: 'detail', name: 'removed' });

    expect(html).toContain('data-workset-scene="list"');
    expect(html).toContain('data-workset-stale-notice');
    expect(html).toContain('removed');
    // No detail surface and no actions retained from the removed Workset.
    expect(html).not.toContain('data-workset-detail=');
    expect(html).not.toContain('data-workset-members=');
  });

  it('slugifies the detail heading id so names with spaces stay a single idref', () => {
    // Pure slug: whitespace and other characters that are illegal inside an id
    // (an aria-labelledby idref list splits on whitespace) collapse to dashes.
    expect(worksetDetailHeadingId('planning')).toBe('workset-detail-planning');
    expect(worksetDetailHeadingId('alpha beta')).toBe('workset-detail-alpha-beta');
    expect(worksetDetailHeadingId('my set (x)')).toBe('workset-detail-my-set-x');
    expect(worksetDetailHeadingId('a  --  b')).toBe('workset-detail-a-b');

    const spacedNavigation: ProjectWorksetNavigationData = {
      ...navigation,
      worksets: [{ ...navigation.worksets[0], name: 'alpha beta' }],
    };
    const html = renderPicker({
      navigation: spacedNavigation,
      initialScene: { kind: 'detail', name: 'alpha beta' },
    });
    expect(html).toContain('aria-labelledby="workset-detail-alpha-beta"');
    expect(html).toMatch(/<h3[^>]*id="workset-detail-alpha-beta"/);
    // The id/idref pair never contains whitespace.
    expect(html).not.toContain('workset-detail-alpha beta');
  });
});

describe('WorksetProjectPicker detail actions', () => {
  it('offers an Open all action that opens the whole Workset without leaving the detail', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });

    expect(html).toContain('data-action="open-workset"');
    expect(html).toContain('aria-label="Open Whole Workset planning"');
    expect(html).toContain('>Open all<');
    expect(html).toContain('data-workset-scene="detail"');
  });

  it('never routes a Planning Store member as a Project target', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });

    const storeIdx = html.indexOf('data-workset-store="team-plans"');
    expect(storeIdx).toBeGreaterThan(-1);
    expect(html).toContain('data-action="use-planning-root"');
    expect(html.slice(storeIdx, html.indexOf('</div>', storeIdx))).not.toContain('data-workset-project=');
    expect(html).not.toMatch(/data-workset-project="\/stores\/team-plans"/);
  });

  it('marks the active Planning Store member as Current root state text, not a disabled action', () => {
    const html = renderPicker({
      initialScene: { kind: 'detail', name: 'planning' },
      activeStoreId: 'team-plans',
    });

    expect(html).toContain('data-workset-member-state="current-root"');
    expect(html).toContain('>Current root<');
    const rowStart = html.lastIndexOf('<div', html.indexOf('data-workset-member-state="current-root"'));
    const rowEnd = html.indexOf('</div>', rowStart);
    expect(html.slice(rowStart, rowEnd)).not.toContain('<button');
    expect(html.slice(rowStart, rowEnd)).not.toContain('disabled');
  });

  it('offers Use as planning root for non-active Store members and hides project-default recovery when unused', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });

    expect(html).toContain('data-action="use-planning-root"');
    expect(html).toContain('aria-label="Use as planning root: team-plans"');
    expect(html).toContain('>Use as planning root<');
    expect(html).not.toContain('data-workset-member-state="current-root"');
    expect(html).not.toContain('data-action="use-project-default"');
  });

  it('gates the project-default recovery on the explicit selector flag, not on binding.storeId', () => {
    // A selector-free default binding may still carry a storeId when the CLI's
    // root.store_id is set (the project default root IS a Store root): the
    // recovery action must stay hidden because no explicit selector is active.
    const selectorFreeStoreRoot = renderPicker({
      initialScene: { kind: 'detail', name: 'planning' },
      activeStoreId: 'team-plans',
    });
    expect(selectorFreeStoreRoot).toContain('data-workset-member-state="current-root"');
    expect(selectorFreeStoreRoot).toContain('>Current root<');
    expect(selectorFreeStoreRoot).not.toContain('data-action="use-project-default"');
    expect(selectorFreeStoreRoot).not.toContain('>Use project default<');

    // With an explicit selector active the recovery action is offered.
    const explicitSelector = renderPicker({
      initialScene: { kind: 'detail', name: 'planning' },
      activeStoreId: 'team-plans',
      explicitStoreSelector: true,
    });
    expect(explicitSelector).toContain('data-action="use-project-default"');
    expect(explicitSelector).toContain('>Use project default<');

    // The flag alone gates the action; it never depends on storeId labeling.
    const explicitSelectorWithoutActiveMember = renderPicker({
      initialScene: { kind: 'detail', name: 'planning' },
      explicitStoreSelector: true,
    });
    expect(explicitSelectorWithoutActiveMember).toContain('data-action="use-project-default"');
    expect(explicitSelectorWithoutActiveMember).toContain('data-action="use-planning-root"');
  });

  it('shows a no-other-Projects state without offering Store members as Project actions', () => {
    const storeOnly: ProjectWorksetNavigationData = {
      project: current,
      worksets: [{
        name: 'stores-only',
        members: [{
          name: 'team-plans',
          path: '/stores/team-plans',
          role: 'store',
          selectable: false,
          storeId: 'team-plans',
        }],
      }],
    };
    const html = renderPicker({
      navigation: storeOnly,
      initialScene: { kind: 'detail', name: 'stores-only' },
    });

    expect(html).toContain('No selectable Projects');
    expect(html).not.toContain('data-workset-project=');
    expect(html).toContain('data-action="use-planning-root"');
  });

  it('covers selectable Project members without a resolved Project context in the empty state', () => {
    // The empty-state predicate must match the row predicate: a member that is
    // neither actionable (no project context) nor current still counts as
    // "no selectable Projects" instead of rendering an unexplained dead row.
    const danglingMember: ProjectWorksetNavigationData = {
      project: current,
      worksets: [{
        name: 'dangling',
        members: [
          {
            name: current.label,
            path: current.projectPath,
            role: 'project',
            selectable: true,
            project: current,
          },
          {
            name: 'Dangling Member',
            path: '/repos/dangling',
            role: 'project',
            selectable: true,
          },
        ],
      }],
    };
    const html = renderPicker({
      navigation: danglingMember,
      initialScene: { kind: 'detail', name: 'dangling' },
    });

    expect(html).toContain('No selectable Projects');
    expect(html).not.toContain('data-workset-project=');
    expect(html).toContain('Dangling Member');
  });

  it('keeps every detail action a keyboard-operable native button', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });

    expect(html).not.toContain('<select');
    // The only text input lives inside the collapsed one-time opener
    // disclosure, which the hidden attribute removes from layout and tab order.
    const inputIdx = html.indexOf('<input');
    if (inputIdx > -1) {
      const formStart = html.lastIndexOf('<form', inputIdx);
      const formOpenTag = html.slice(formStart, html.indexOf('>', formStart) + 1);
      expect(formOpenTag).toContain('hidden');
    }
    expect(html.match(/<button[^>]*type="button"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('focus-visible:outline-[var(--vscode-focusBorder)]');
  });
});

describe('WorksetProjectPicker one-time opener', () => {
  it('normalizes submitted opener ids and rejects empty values', () => {
    expect(normalizeOneTimeOpenerTool(undefined)).toBeUndefined();
    expect(normalizeOneTimeOpenerTool('')).toBeUndefined();
    expect(normalizeOneTimeOpenerTool('   ')).toBeUndefined();
    expect(normalizeOneTimeOpenerTool(' cursor ')).toBe('cursor');
    expect(normalizeOneTimeOpenerTool('my-custom-tool')).toBe('my-custom-tool');
  });

  it('keeps the one-time opener form mounted but hidden until explicitly requested', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });

    expect(html).toContain('data-action="reveal-one-time-opener"');
    expect(html).toContain('>Open with another tool<');
    // The disclosure form stays mounted so the toggle's aria-controls id always
    // resolves to a real element, while the hidden attribute removes the form
    // from layout, tab order, and the accessibility tree.
    expect(html).toMatch(/<form[^>]*id="workset-one-time-opener-form"[^>]*hidden/);
    expect(html).toContain('data-one-time-opener-form');
  });

  it('mounts the expanded opener form with its id, aria-controls, and aria-expanded coexisting', () => {
    const html = renderPicker({
      initialScene: { kind: 'detail', name: 'planning' },
      initialOpenerOpen: true,
    });

    const toggleMatch = html.match(/<button[^>]*data-action="reveal-one-time-opener"[^>]*>/);
    expect(toggleMatch?.[0]).toContain('aria-expanded="true"');
    expect(toggleMatch?.[0]).toContain('aria-controls="workset-one-time-opener-form"');
    // The controlled element exists in the same document and is visible: the
    // expanded disclosure carries no hidden attribute.
    const formMatch = html.match(/<form[^>]*id="workset-one-time-opener-form"[^>]*>/);
    expect(formMatch).not.toBeNull();
    expect(formMatch?.[0]).not.toContain('hidden');
    expect(formMatch?.[0]).toContain('data-one-time-opener-form');
  });

  it('renders a free-form opener editor with code/cursor shortcuts and one submit action', () => {
    const html = renderToStaticMarkup(
      <WorksetOneTimeOpenerForm name="planning" onOpen={vi.fn()} />,
    );

    expect(html).toContain('data-one-time-opener-form');
    expect(html).toMatch(/<input[^>]*type="text"/);
    expect(html).toContain('aria-label="Custom opener id"');
    expect(html).toContain('data-one-time-tool-shortcut="code"');
    expect(html).toContain('data-one-time-tool-shortcut="cursor"');
    expect((html.match(/data-action="open-with-one-time-tool"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('type="button"');
  });

  it('submits the opener editor through a real form so Enter performs exactly one open', () => {
    const html = renderToStaticMarkup(
      <WorksetOneTimeOpenerForm name="planning" onOpen={vi.fn()} />,
    );

    // The editor is a native form: pressing Enter in the text input submits it.
    const formMatch = html.match(/<form[^>]*data-one-time-opener-form[^>]*>/);
    expect(formMatch).not.toBeNull();
    const formStart = html.indexOf('<form');
    const formEnd = html.indexOf('</form>', formStart);
    expect(html.slice(formStart, formEnd)).toMatch(/<input[^>]*type="text"/);
    // Exactly one submit control; shortcuts stay auxiliary buttons.
    expect((html.match(/type="submit"/g) ?? [])).toHaveLength(1);
    const submitMatch = html.match(/<button[^>]*data-action="open-with-one-time-tool"[^>]*>/);
    expect(submitMatch?.[0]).toContain('type="submit"');
  });
});

describe('whole-Workset open isolation', () => {
  it('stops propagation and performs exactly one open per activation', () => {
    const open = vi.fn();
    const stopPropagation = vi.fn();

    runWorksetOpenAction('planning', open, { stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('planning');

    runWorksetOpenAction('planning', open, { stopPropagation }, 'cursor');
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith('planning', 'cursor');
    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });
});

describe('WorksetProjectPicker create draft', () => {
  it('seeds the draft with the current Project as the locked initial member and Primary', () => {
    expect(openWorksetCreateScene(current)).toEqual({
      kind: 'create',
      draft: { name: '', members: [current.projectPath], tool: '' },
    });
  });

  it('moves the chosen member to the front for Primary while keeping every member', () => {
    const draft: WorksetCreateDraft = {
      name: 'feature',
      tool: '',
      members: [current.projectPath, '/repos/docs', '/repos/other'],
    };
    expect(promoteWorksetPrimaryMember(draft, '/repos/other').members).toEqual([
      '/repos/other',
      current.projectPath,
      '/repos/docs',
    ]);
    // Promoting the current Primary or an unknown path is a no-op.
    expect(promoteWorksetPrimaryMember(draft, current.projectPath).members).toEqual(draft.members);
    expect(promoteWorksetPrimaryMember(draft, '/repos/unknown').members).toEqual(draft.members);
  });

  it('never removes the locked current Project member but removes others', () => {
    const draft: WorksetCreateDraft = {
      name: 'feature',
      tool: '',
      members: [current.projectPath, '/repos/docs'],
    };
    expect(removeWorksetDraftMember(draft, current.projectPath, current.projectPath).members)
      .toEqual([current.projectPath, '/repos/docs']);
    expect(removeWorksetDraftMember(draft, '/repos/docs', current.projectPath).members)
      .toEqual([current.projectPath]);
  });

  it('merges picked paths uniquely by canonical path and flags invalid entries', () => {
    const draft: WorksetCreateDraft = { name: '', tool: '', members: [current.projectPath] };
    const merged = mergePickedWorksetMembers(draft, [
      '/repos/docs',
      '/repos/docs',
      current.projectPath,
      'relative/path',
      42,
      '',
    ]);
    expect(merged.draft.members).toEqual([current.projectPath, '/repos/docs']);
    expect(merged.droppedInvalid).toBe(true);

    const clean = mergePickedWorksetMembers(draft, ['/repos/a', 'C:\\repos\\b']);
    expect(clean.draft.members).toEqual([current.projectPath, '/repos/a', 'C:\\repos\\b']);
    expect(clean.droppedInvalid).toBe(false);
  });

  it('preserves the create scene across same-Project snapshot refreshes', () => {
    const scene = openWorksetCreateScene(current);
    const projectKey = worksetPickerProjectKey(current);
    expect(
      resolveWorksetPickerScene(scene, projectKey, { ...navigation, worksets: [...navigation.worksets] }),
    ).toBe(scene);
  });

  it('resets the create scene when Project identity changes', () => {
    const selection = {
      projectKey: worksetPickerProjectKey(current),
      scene: openWorksetCreateScene(current),
      openerEditor: null,
    };
    const otherKey = worksetPickerProjectKey({
      ...current,
      id: '/projects/other',
      projectPath: '/projects/other',
    });
    expect(resetWorksetPickerSelectionForProject(selection, otherKey)).toEqual({
      projectKey: otherKey,
      scene: { kind: 'list' },
      openerEditor: null,
    });
  });
});

describe('WorksetProjectPicker picker response application', () => {
  const selectionIn = (scene: Parameters<typeof resetWorksetPickerSelectionForProject>[0]['scene']) => ({
    projectKey: worksetPickerProjectKey(current),
    scene,
    openerEditor: null,
  });

  it('applies a picker response only inside the create scene and only once per response', () => {
    const next = reconcileWorksetPickerResponses(
      selectionIn(openWorksetCreateScene(current)),
      navigation,
      { seq: 1, paths: ['/repos/docs'] },
      null,
    );
    expect(next.scene).toEqual({
      kind: 'create',
      draft: { name: '', tool: '', members: [current.projectPath, '/repos/docs'] },
    });
    expect(next.appliedPickedSeq).toBe(1);
    // The same response never re-applies (stable reference).
    expect(
      reconcileWorksetPickerResponses(next, navigation, { seq: 1, paths: ['/repos/docs'] }, null),
    ).toBe(next);
  });

  it('marks invalid picked paths with a recoverable notice instead of adding them', () => {
    const next = reconcileWorksetPickerResponses(
      selectionIn(openWorksetCreateScene(current)),
      navigation,
      { seq: 2, paths: ['/repos/docs', 'relative'] },
      null,
    );
    expect(next.scene.kind).toBe('create');
    expect(next.createNotice).toEqual({ kind: 'invalidMembers' });
    expect(next.scene.kind === 'create' && next.scene.draft.members).toEqual([
      current.projectPath,
      '/repos/docs',
    ]);
  });

  it('ignores a late picker response after the surface left the create scene', () => {
    const next = reconcileWorksetPickerResponses(
      selectionIn(backToWorksetListScene()),
      navigation,
      { seq: 7, paths: ['/repos/late'] },
      null,
    );
    expect(next.scene).toEqual({ kind: 'list' });
    expect(next.appliedPickedSeq).toBe(7);
    expect(
      reconcileWorksetPickerResponses(next, navigation, { seq: 7, paths: ['/repos/late'] }, null),
    ).toBe(next);
  });

  it('keeps the create draft untouched when the picker response carries no eligible path', () => {
    const next = reconcileWorksetPickerResponses(
      selectionIn(openWorksetCreateScene(current)),
      navigation,
      { seq: 3, paths: [] },
      null,
    );
    expect(next.scene).toEqual({
      kind: 'create',
      draft: { name: '', tool: '', members: [current.projectPath] },
    });
    expect(next.appliedPickedSeq).toBe(3);
  });

  it('records the recoverable invalid-member notice for Host-dropped unrealpath-able picks', () => {
    // All picked paths are valid; the Host still dropped one because its
    // realpath could not be resolved — the notice must appear anyway.
    const next = reconcileWorksetPickerResponses(
      selectionIn(openWorksetCreateScene(current)),
      navigation,
      { seq: 4, paths: ['/repos/docs'], droppedPaths: ['/repos/gone'] },
      null,
    );
    expect(next.scene.kind).toBe('create');
    expect(next.scene.kind === 'create' && next.scene.draft.members).toEqual([
      current.projectPath,
      '/repos/docs',
    ]);
    expect(next.createNotice).toEqual({ kind: 'invalidMembers' });

    // An empty add with only dropped paths still explains itself.
    const allDropped = reconcileWorksetPickerResponses(
      selectionIn(openWorksetCreateScene(current)),
      navigation,
      { seq: 5, paths: [], droppedPaths: ['/repos/gone-a', '/repos/gone-b'] },
      null,
    );
    expect(allDropped.scene.kind === 'create' && allDropped.scene.draft.members).toEqual([
      current.projectPath,
    ]);
    expect(allDropped.createNotice).toEqual({ kind: 'invalidMembers' });
  });

  it('renders the invalid-member notice for Host-dropped picks while adding the valid ones', () => {
    const html = renderPicker({
      initialScene: openWorksetCreateScene(current),
      pickedMembers: { seq: 9, paths: ['/repos/docs'], droppedPaths: ['/repos/gone'] },
    });

    expect(html).toContain('data-create-notice');
    expect(html).toContain('Some selected folders were not added');
    expect(html).toContain('data-create-member="/repos/docs"');
    expect(html).not.toContain('data-create-member="/repos/gone"');
  });
});

describe('WorksetProjectPicker create form rendering', () => {
  it('renders name, tool, members, add-folders, cancel, and submit controls', () => {
    const html = renderPicker({ initialScene: openWorksetCreateScene(current) });

    expect(html).toContain('data-workset-scene="create"');
    expect(html).toContain('data-workset-create-form');
    expect(html).toContain('data-create-workset-name');
    expect(html).toContain('data-create-workset-tool');
    expect(html).toContain('data-create-member="/projects/current"');
    expect(html).toContain('data-create-member-state="current-project"');
    expect(html).toContain('data-create-member-primary="true"');
    expect(html).toContain('data-action="pick-workset-members"');
    expect(html).toContain('data-action="cancel-create-workset"');
    expect(html).toContain('data-action="submit-create-workset"');
    // Submit stays inert while the trimmed name is empty.
    expect(html).toMatch(/data-action="submit-create-workset"[^>]*disabled/);
    // The list rows are not rendered behind the create form.
    expect(html).not.toContain('data-workset-row=');
  });

  it('visually mutes the disabled submit instead of saturated primary in dark/light themes', () => {
    // Visual acceptance D1: with only the native disabled attribute, dark/light
    // themes render the submit at full --vscode-button-background saturation,
    // so the disabled state is invisible (High Contrast grays it by itself).
    // The same disabled-variant muting idiom as ChangePagination (opacity +
    // no-click cursor) must ride along on the submit's class string.
    const submitTagOf = (markup: string) =>
      markup.match(/<button[^>]*data-action="submit-create-workset"[^>]*>/)?.[0] ?? '';

    // Disabled (empty trimmed name): native disabled attribute AND the
    // disabled: variant utilities together.
    const disabledTag = submitTagOf(renderPicker({ initialScene: openWorksetCreateScene(current) }));
    expect(disabledTag).not.toBe('');
    // The word "disabled" as an attribute (not the disabled: class variant).
    expect(disabledTag).toMatch(/\bdisabled(?!:)/);
    expect(disabledTag).toContain('disabled:opacity-50');
    expect(disabledTag).toContain('disabled:cursor-not-allowed');

    // Enabled (valid trimmed name): no disabled attribute and no standalone
    // muting utilities — the disabled: variants never activate outside
    // :disabled, so the enabled control stays fully saturated primary.
    const enabledTag = submitTagOf(renderPicker({
      initialScene: {
        kind: 'create',
        draft: { name: 'feature', tool: '', members: [current.projectPath] },
      },
    }));
    expect(enabledTag).not.toBe('');
    expect(enabledTag).not.toMatch(/\bdisabled(?!:)/);
    // Standalone (space-prefixed) muting utilities must not leak into enabled.
    expect(enabledTag).not.toMatch(/\sopacity-50/);
    expect(enabledTag).not.toMatch(/\scursor-not-allowed/);
  });

  it('locks the current Project member: state text, no remove control, no promote while Primary', () => {
    const html = renderPicker({
      initialScene: {
        kind: 'create',
        draft: { name: 'feature', tool: '', members: [current.projectPath, '/repos/docs'] },
      },
    });

    const lockedIdx = html.indexOf('data-create-member-state="current-project"');
    expect(lockedIdx).toBeGreaterThan(-1);
    const rowStart = html.lastIndexOf('<div', lockedIdx);
    const rowEnd = html.indexOf('</div>', lockedIdx);
    const lockedRow = html.slice(rowStart, rowEnd);
    expect(lockedRow).not.toContain('data-action="remove-create-member"');
    // Already Primary in this draft: no promote control either.
    expect(lockedRow).not.toContain('data-action="promote-create-primary"');
    // Unlocked members expose both primary promotion and removal.
    expect(html).toContain('data-action="promote-create-primary"');
    expect(html).toContain('data-action="remove-create-member"');
  });

  it('offers primary promotion for a locked non-Primary member while keeping it locked', () => {
    const html = renderPicker({
      initialScene: {
        kind: 'create',
        draft: { name: 'feature', tool: '', members: ['/repos/docs', current.projectPath] },
      },
    });

    const lockedIdx = html.indexOf('data-create-member-state="current-project"');
    const rowStart = html.lastIndexOf('<div', lockedIdx);
    const rowEnd = html.indexOf('</div>', lockedIdx);
    const lockedRow = html.slice(rowStart, rowEnd);
    expect(lockedRow).toContain('data-action="promote-create-primary"');
    expect(lockedRow).not.toContain('data-action="remove-create-member"');
  });

  it('offers a Create Workset entry from the list scene', () => {
    const html = renderPicker();

    expect(html).toContain('data-workset-scene="list"');
    expect(html).toContain('data-action="create-workset"');
    expect(html).toContain('>Create Workset<');
  });

  it('renders an empty-list state with the Create entry when no worksets exist', () => {
    const emptyNavigation: ProjectWorksetNavigationData = {
      project: current,
      worksets: [],
    };
    const html = renderPicker({ navigation: emptyNavigation });

    expect(html).toContain('data-workset-scene="list"');
    expect(html).toContain('data-workset-empty-list');
    expect(html).toContain('No Worksets yet');
    // The primary first-creation entry stays reachable from the empty list.
    expect(html).toContain('data-action="create-workset"');
    expect(html).not.toContain('data-workset-row=');
  });

  it('hides the Create entry and shows the upgrade explanation when the Workset capability is unavailable', () => {
    const emptyNavigation: ProjectWorksetNavigationData = {
      project: current,
      worksets: [],
    };
    const html = renderPicker({ navigation: emptyNavigation, createAvailable: false });

    expect(html).toContain('data-workset-scene="list"');
    expect(html).toContain('data-workset-empty-list');
    expect(html).not.toContain('data-action="create-workset"');
    expect(html).toContain('data-workset-capability-notice');
    // Existing upgrade copy is reused for the capability explanation.
    expect(html).toContain('Stores and worksets require OpenSpec 1.5.0 or newer.');
    // The existing list/detail surface itself stays rendered.
    expect(html).toContain('data-workset-project-picker');
  });

  it('keeps the Create entry for existing worksets when the capability is explicitly available', () => {
    const html = renderPicker({ createAvailable: true });

    expect(html).toContain('data-action="create-workset"');
    expect(html).not.toContain('data-workset-capability-notice');
    expect(html).not.toContain('data-workset-empty-list');
  });

  it('shows a recoverable notice for invalid picked members without adding them', () => {
    const html = renderPicker({
      initialScene: openWorksetCreateScene(current),
      pickedMembers: { seq: 9, paths: ['/repos/docs', 'relative'] },
    });

    expect(html).toContain('data-create-notice');
    expect(html).toContain('data-create-member="/repos/docs"');
    expect(html).not.toContain('data-create-member="relative"');
  });
});

describe('WorksetProjectPicker create result application', () => {
  const featureNavigation: ProjectWorksetNavigationData = {
    project: current,
    worksets: [
      ...navigation.worksets,
      {
        name: 'feature',
        members: [
          {
            name: current.label,
            path: current.projectPath,
            role: 'project' as const,
            selectable: true,
            project: current,
          },
        ],
      },
    ],
  };
  const selectionIn = (scene: Parameters<typeof resetWorksetPickerSelectionForProject>[0]['scene']) => ({
    projectKey: worksetPickerProjectKey(current),
    scene,
    openerEditor: null,
  });

  it('enters the detail scene only for a success result present in the fresh navigation', () => {
    const next = reconcileWorksetPickerResponses(
      selectionIn({ kind: 'create', draft: { name: 'feature', tool: '', members: [current.projectPath] } }),
      featureNavigation,
      null,
      { seq: 4, success: true, name: 'feature' },
    );
    expect(next.scene).toEqual({ kind: 'detail', name: 'feature' });
    expect(next.appliedResultSeq).toBe(4);
  });

  it('stays in create when a success result names a Workset missing from the navigation', () => {
    const next = reconcileWorksetPickerResponses(
      selectionIn({ kind: 'create', draft: { name: 'ghost', tool: '', members: [current.projectPath] } }),
      navigation,
      null,
      { seq: 4, success: true, name: 'ghost' },
    );
    expect(next.scene).toEqual({
      kind: 'create',
      draft: { name: 'ghost', tool: '', members: [current.projectPath] },
    });
    expect(next.createNotice).toBeUndefined();
  });

  it('preserves the draft and records the recoverable failure message', () => {
    const draft = { name: 'feature', tool: 'cursor', members: [current.projectPath, '/repos/docs'] };
    const next = reconcileWorksetPickerResponses(
      selectionIn({ kind: 'create', draft }),
      featureNavigation,
      null,
      { seq: 5, success: false, name: 'feature', message: 'duplicate name' },
    );
    expect(next.scene).toEqual({ kind: 'create', draft });
    expect(next.createNotice).toEqual({ kind: 'createFailed', message: 'duplicate name' });
    // The same result never re-applies (stable reference).
    expect(
      reconcileWorksetPickerResponses(next, featureNavigation, null, {
        seq: 5,
        success: false,
        name: 'feature',
        message: 'duplicate name',
      }),
    ).toBe(next);
  });

  it('renders the success transition from create to the new detail', () => {
    const html = renderPicker({
      navigation: featureNavigation,
      initialScene: {
        kind: 'create',
        draft: { name: 'feature', tool: '', members: [current.projectPath, '/repos/docs'] },
      },
      createResult: { seq: 6, success: true, name: 'feature' },
    });

    expect(html).toContain('data-workset-scene="detail"');
    expect(html).toContain('data-workset-detail="feature"');
    expect(html).not.toContain('data-workset-create-form');
  });

  it('renders a failure result as a notice that keeps the draft intact', () => {
    const html = renderPicker({
      navigation: featureNavigation,
      initialScene: {
        kind: 'create',
        draft: { name: 'feature', tool: 'cursor', members: ['/repos/docs', current.projectPath] },
      },
      createResult: { seq: 7, success: false, name: 'feature', message: 'duplicate name' },
    });

    expect(html).toContain('data-workset-scene="create"');
    expect(html).toContain('data-create-notice');
    expect(html).toContain('duplicate name');
    // The draft is untouched: ordered members and the entered name survive.
    expect(html).toContain('data-create-member="/repos/docs"');
    expect(html).toContain('data-create-member-primary="true"');
  });

  it('normalizes the submitted draft: trimmed name, ordered members, omitted empty tool', () => {
    expect(
      normalizeWorksetCreateSubmit({ name: '  feature  ', tool: '', members: [current.projectPath, '/repos/docs'] }),
    ).toEqual({ name: 'feature', members: [current.projectPath, '/repos/docs'] });
    expect(
      normalizeWorksetCreateSubmit({ name: 'feature', tool: ' cursor ', members: [current.projectPath] }),
    ).toEqual({ name: 'feature', members: [current.projectPath], tool: 'cursor' });
    expect(
      normalizeWorksetCreateSubmit({ name: '   ', tool: '', members: [current.projectPath] }),
    ).toBeUndefined();
  });

  it('wires the create submit through normalization to exactly one Host call', () => {
    const onCreateWorkset = vi.fn();
    const draft: WorksetCreateDraft = {
      name: '  feature  ',
      tool: ' cursor ',
      members: [current.projectPath, '/repos/docs'],
    };

    const sent = runWorksetCreateSubmit(draft, onCreateWorkset);

    expect(sent).toBe(true);
    expect(onCreateWorkset).toHaveBeenCalledTimes(1);
    expect(onCreateWorkset).toHaveBeenCalledWith('feature', [current.projectPath, '/repos/docs'], 'cursor');

    // An unsubmittable draft performs no Host call at all.
    const invalidCall = vi.fn();
    expect(runWorksetCreateSubmit({ name: '   ', tool: '', members: [current.projectPath] }, invalidCall)).toBe(false);
    expect(invalidCall).not.toHaveBeenCalled();
  });
});

describe('WorksetProjectPicker visual copy, accessibility, and narrow-sidebar styling', () => {
  it('keeps the Back arrow glyph hidden from assistive tech while the label stays translated text', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });
    const backIdx = html.indexOf('data-action="back-to-worksets"');
    expect(backIdx).toBeGreaterThan(-1);
    const backEnd = html.indexOf('</button>', backIdx);
    const backButton = html.slice(backIdx, backEnd);
    // The "←" glyph is wrapped in an aria-hidden span so screen readers never
    // announce "left arrow"; the visible label is pure t() text.
    expect(backButton).toMatch(/<span[^>]*aria-hidden="true"[^>]*>\u2190<\/span>/);
    // The translated label is the only announced text (plain text after the
    // decorative glyph, never "← Back to Worksets" as one text run).
    expect(backButton).toMatch(/<\/span>Back to Worksets$/);
    expect(backButton).not.toContain('>\u2190 Back to Worksets<');
  });

  it('keeps the visible label inside the accessible name for primary and planning-root actions', () => {
    // Label-in-Name (WCAG 2.5.3): the visible action text must appear verbatim
    // inside the aria-label so speech-input activation matches what is seen.
    const detail = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });
    expect(detail).toContain('aria-label="Use as planning root: team-plans"');
    expect(detail).toContain('>Use as planning root<');

    const create = renderPicker({
      initialScene: {
        kind: 'create',
        draft: { name: 'feature', tool: '', members: [current.projectPath, '/repos/docs'] },
      },
    });
    expect(create).toContain('aria-label="Make primary: /repos/docs"');
    expect(create).toContain('>Make primary<');

    // zh-cn keeps the same containment contract with localized phrasing.
    setLocale('zh-cn');
    try {
      const zhDetail = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });
      expect(zhDetail).toContain('aria-label="设为规划根：team-plans"');
      expect(zhDetail).toContain('>设为规划根<');

      const zhCreate = renderPicker({
        initialScene: {
          kind: 'create',
          draft: { name: 'feature', tool: '', members: [current.projectPath, '/repos/docs'] },
        },
      });
      expect(zhCreate).toContain('aria-label="设为主成员：/repos/docs"');
      expect(zhCreate).toContain('>设为主成员<');
    } finally {
      setLocale('en');
    }
  });

  it('uses the theme-token focus-visible outline idiom instead of the default-blue ring or dead outlineColor', () => {
    const html = renderPicker();
    const detail = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });
    const create = renderPicker({ initialScene: openWorksetCreateScene(current) });
    for (const markup of [html, detail, create]) {
      expect(markup).toContain('focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]');
      expect(markup).not.toContain('focus:ring');
      expect(markup).not.toContain('outline-color');
      expect(markup).not.toContain('focus-visible:ring');
    }
  });

  it('gives every button control an accessible name (no icon-only or bare controls)', () => {
    for (const markup of [
      renderPicker(),
      renderPicker({ initialScene: { kind: 'detail', name: 'planning' } }),
      renderPicker({ initialScene: openWorksetCreateScene(current) }),
      renderToStaticMarkup(<WorksetOneTimeOpenerForm name="planning" onOpen={vi.fn()} />),
    ]) {
      const buttons = markup.match(/<button[^>]*>/g) ?? [];
      expect(buttons.length).toBeGreaterThan(0);
      for (const tag of buttons) {
        expect(tag).toContain('aria-label=');
      }
    }
  });

  it('exposes one-time opener toggle state via aria-expanded and ties it to the form id', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });
    const toggleMatch = html.match(/<button[^>]*data-action="reveal-one-time-opener"[^>]*>/);
    expect(toggleMatch?.[0]).toContain('aria-expanded="false"');
    expect(toggleMatch?.[0]).toContain('aria-controls="workset-one-time-opener-form"');

    const formHtml = renderToStaticMarkup(<WorksetOneTimeOpenerForm name="planning" onOpen={vi.fn()} />);
    expect(formHtml).toMatch(/<form[^>]*id="workset-one-time-opener-form"/);
    // The free-form input keeps its explicit label; no heavyweight combobox
    // semantics are introduced.
    expect(formHtml).toContain('aria-label="Custom opener id"');
  });

  it('shows best-effort repository identity as visible text next to the branch for git worktree members', () => {
    // Pure label: repository identity is shortened to its best-effort basename
    // so a ~430px row shows repo AND branch, with the full path in the tooltip.
    expect(formatWorksetMemberGitLabel({ repository: '/repos/docs', branch: 'feature/docs' }))
      .toBe('docs \u00b7 feature/docs');
    expect(formatWorksetMemberGitLabel({ branch: 'main' })).toBe('main');
    expect(formatWorksetMemberGitLabel({ repository: 'C:\\repos\\x' })).toBe('x');
    expect(formatWorksetMemberGitLabel(undefined)).toBe('');

    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });
    // Visible text (not tooltip-only) beside the member name.
    expect(html).toContain('docs \u00b7 feature/docs');
    // The full repository path stays available as tooltip metadata.
    expect(html).toContain('title="/repos/docs"');
  });

  it('pairs Project and Store identity icons with text, never color or icon alone', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });

    expect(html).toContain('codicon-folder');
    expect(html).toContain('codicon-library');
    expect(html).toContain('aria-hidden="true"');
    // Text identity: project member names and the store role text both render.
    expect(html).toContain('Docs Worktree');
    expect(html).toContain('Planning Store');
  });

  it('renders the list as one lightly-separated surface group with hover feedback and a chevron affordance', () => {
    const html = renderPicker();

    expect(html).toContain('data-workset-list');
    expect(html).toContain('divide-y');
    // Light separators use the theme panel border, not per-row card borders.
    expect(html).toContain('divide-[color:var(--vscode-panel-border)]');
    expect(html).toContain('hover:bg-[var(--vscode-list-hoverBackground)]');
    expect(html).toContain('codicon-chevron-right');
  });

  it('groups the empty Worksets state with the Create entry as one clear unit', () => {
    const emptyNavigation: ProjectWorksetNavigationData = {
      project: current,
      worksets: [],
    };
    const html = renderPicker({ navigation: emptyNavigation });

    const groupStart = html.indexOf('data-workset-empty-group');
    expect(groupStart).toBeGreaterThan(-1);
    const groupEnd = html.indexOf('</div>', groupStart);
    const group = html.slice(groupStart, groupEnd);
    expect(group).toContain('data-workset-empty-list');
    expect(group).toContain('data-action="create-workset"');
  });

  it('labels the detail member group with a section header', () => {
    const html = renderPicker({ initialScene: { kind: 'detail', name: 'planning' } });

    expect(html).toContain('data-workset-members-section');
    expect(html).toContain('>Members<');
    expect(html).toContain('3 members');
  });

  it('orders the create form fields Name, Members, Tool and stacks full-width submit then cancel', () => {
    const html = renderPicker({ initialScene: openWorksetCreateScene(current) });

    const iName = html.indexOf('data-create-workset-name');
    const iMembers = html.indexOf('data-workset-create-members');
    const iTool = html.indexOf('data-create-workset-tool');
    const iSubmit = html.indexOf('data-action="submit-create-workset"');
    const iCancel = html.indexOf('data-action="cancel-create-workset"');
    expect([iName, iMembers, iTool, iSubmit, iCancel].every((i) => i > -1)).toBe(true);
    expect(iName).toBeLessThan(iMembers);
    expect(iMembers).toBeLessThan(iTool);
    expect(iTool).toBeLessThan(iSubmit);
    expect(iSubmit).toBeLessThan(iCancel);
    expect(html).toMatch(/data-action="submit-create-workset"[^>]*class="[^"]*w-full/);
    expect(html).toMatch(/data-action="cancel-create-workset"[^>]*class="[^"]*w-full/);
    // The tool field keeps a helper line so the override capability is explicit.
    expect(html).toContain('Can be overridden when opening.');
  });

  it('limits animations to 120-160ms color transitions and keeps a reduced-motion escape hatch', () => {
    for (const markup of [
      renderPicker(),
      renderPicker({ initialScene: { kind: 'detail', name: 'planning' } }),
      renderPicker({ initialScene: openWorksetCreateScene(current) }),
    ]) {
      const durations = markup.match(/duration-\d+/g) ?? [];
      expect(durations.length).toBeGreaterThan(0);
      for (const duration of durations) {
        expect(duration).toBe('duration-150');
      }
      const transitions = markup.match(/transition-[a-z-]+/g) ?? [];
      for (const transition of transitions) {
        expect(transition).toBe('transition-colors');
      }
    }
    // The global reduced-motion kill switch stays in place for the webview.
    // Resolved from the test file itself (import.meta.url) so the read does
    // not depend on the process cwd. The repo's commonjs tsc setting rejects
    // import.meta syntactically while vitest executes this file as ESM; the
    // directive silences only that config mismatch and resurfaces as an
    // unused-directive error if the module setting ever moves to ESM.
    const css = readFileSync(
      new URL(
        '../../../src/webview/index.css',
        // @ts-expect-error -- commonjs tsc rejects import.meta; the vitest ESM runtime provides it
        import.meta.url,
      ),
      'utf8',
    );
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('bounds every fixed minimum width and keeps names truncating in both locales', () => {
    const longNavigation: ProjectWorksetNavigationData = {
      ...navigation,
      worksets: [{
        ...navigation.worksets[0],
        name: 'A very long Workset label that must remain bounded',
      }],
    };
    const enList = renderPicker({ navigation: longNavigation });
    for (const markup of [
      enList,
      renderPicker({ navigation: longNavigation, initialScene: { kind: 'detail', name: 'planning' } }),
      renderPicker({ navigation: longNavigation, initialScene: openWorksetCreateScene(current) }),
    ]) {
      // Whitelist-style narrow-width invariant: arbitrary fixed widths —
      // Tailwind bracket widths or inline width styles — are forbidden
      // outright across the list/detail/create markup because the ~430px
      // surface must stay fluid. No exceptions exist today; if one ever
      // becomes genuinely necessary, document it inline here instead of
      // weakening the guard globally.
      expect([...markup.matchAll(/(?:min-|max-)?w-\[\d+px\]/g)].map((m) => m[0])).toEqual([]);
      expect(markup).not.toMatch(/style="[^"]*(?:min-|max-)?width\s*:/);
      expect(markup).toContain('min-w-0');
      expect(markup).toContain('truncate');
    }

    // zh-cn renders fully localized copy with the same bounding utilities.
    setLocale('zh-cn');
    try {
      const zhList = renderPicker({ navigation: longNavigation });
      expect(zhList).toContain('工作集项目');
      expect(zhList).not.toContain('worksetNavigation.');
      expect(zhList).toContain('min-w-0');
      const zhDetail = renderPicker({ navigation: longNavigation, initialScene: { kind: 'detail', name: 'planning' } });
      expect(zhDetail).toContain('返回工作集列表');
      expect(zhDetail).not.toContain('worksetNavigation.');
      const zhCreate = renderPicker({ initialScene: openWorksetCreateScene(current) });
      expect(zhCreate).toContain('创建工作集');
      expect(zhCreate).not.toContain('worksetCreate.');
    } finally {
      setLocale('en');
    }
  });
});
