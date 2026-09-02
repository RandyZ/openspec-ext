import React, { useState } from 'react';
import { t } from '../../i18n';
import type {
  ProjectContext,
  ProjectWorksetNavigationData,
  WorksetNavigationMember,
} from '../types/messages';

/**
 * Component-local creation draft. `members` is an ordered list of unique
 * canonical folder paths: the first entry IS the Primary member (no parallel
 * Primary field exists). The draft is never persisted and never leaves the
 * component except as an explicit `createWorkset` submission.
 */
export interface WorksetCreateDraft {
  readonly name: string;
  readonly members: readonly string[];
  readonly tool: string;
}

/**
 * Local view state of the Worksets surface. `list` renders one collapsed row
 * per containing Workset; `detail` renders a single Workset; `create` renders
 * the single-screen creation form with its draft. `staleDetailName` records a
 * detail that disappeared from a fresh trusted navigation snapshot: the surface
 * returns to the list and explains the recovery.
 */
export type WorksetPickerScene =
  | { readonly kind: 'list'; readonly staleDetailName?: string }
  | { readonly kind: 'detail'; readonly name: string }
  | { readonly kind: 'create'; readonly draft: WorksetCreateDraft };

export interface WorksetProjectPickerProps {
  navigation: ProjectWorksetNavigationData;
  /** Active Planning-root Store id from the trusted Host binding; undefined = project default root. */
  activeStoreId?: string;
  /**
   * Host-returned fact: an explicit Planning Store selector is active. Gates
   * the `Use project default` recovery; a selector-free default binding may
   * still carry a storeId (CLI root.store_id), so this flag never derives
   * from `activeStoreId`.
   */
  explicitStoreSelector?: boolean;
  onSelectProject: (worksetName: string, memberPath: string) => void;
  onSelectWorksetStore: (worksetName: string, memberPath: string) => void;
  onSelectProjectDefaultRoot: () => void;
  onOpenWorkset: (name: string, tool?: string) => void;
  /** Requests the native folder picker; the result returns via `pickedMembers`. */
  onPickMembers: () => void;
  /** Submits the draft through the official Host create path. */
  onCreateWorkset: (name: string, members: string[], tool?: string) => void;
  onBackToCurrentProject: () => void;
  /**
   * Latest `worksetMembersPicked` response from the Host (sequence-stamped).
   * It is applied at most once, and only while the create scene is active —
   * a response that arrives after leaving the form is ignored harmlessly.
   * `droppedPaths` lists picks the Host could not canonicalize: they were not
   * added and must be explained recoverably.
   */
  pickedMembers?: Readonly<{ seq: number; paths: readonly unknown[]; droppedPaths?: readonly string[] }> | null;
  /**
   * Latest `worksetCreateResult` response from the Host (sequence-stamped).
   * Success enters the new Workset detail only when the fresh navigation
   * contains that name; failure preserves the draft with a recoverable notice.
   */
  createResult?: Readonly<{
    seq: number;
    success: boolean;
    name: string;
    message?: string;
  }> | null;
  /**
   * Initial local scene. Production callers omit it (the surface always starts
   * on the list); it exists so the detail and stale-detail states are testable
   * without a DOM. It is never persisted and never driven by the Host.
   */
  initialScene?: WorksetPickerScene;
  /**
   * Initial one-time opener editor open state. Production callers omit it (the
   * disclosure starts collapsed); it exists so the expanded state — where the
   * aria-controls id and the mounted form must coexist — is testable without
   * a DOM. It is never persisted and never driven by the Host.
   */
  initialOpenerOpen?: boolean;
  /**
   * Host-resolved Workset capability (`worksetCapabilityAvailable`). `false`
   * hides the Create entry and shows the upgrade explanation; `undefined`
   * (legacy cached payloads) keeps the Create entry available.
   */
  createAvailable?: boolean;
}

interface WorksetOneTimeOpenerEditorState {
  readonly worksetName: string;
}

/** Recoverable, in-form feedback for the creation flow; never a modal error. */
export type WorksetCreateNotice =
  | { readonly kind: 'invalidMembers' }
  | { readonly kind: 'createFailed'; readonly message?: string };

interface WorksetPickerSelection {
  readonly projectKey: string;
  readonly scene: WorksetPickerScene;
  /** One-time opener editor opened for this detail target; null = closed. */
  readonly openerEditor: WorksetOneTimeOpenerEditorState | null;
  /** Sequence of the last applied `worksetMembersPicked` response. */
  readonly appliedPickedSeq?: number;
  /** Sequence of the last applied `worksetCreateResult` response. */
  readonly appliedResultSeq?: number;
  /** Active recoverable create-form notice; undefined = none. */
  readonly createNotice?: WorksetCreateNotice;
}

/** Stable identity of the Project whose trusted navigation drives the surface. */
export function worksetPickerProjectKey(project: ProjectContext): string {
  return `${project.id}\u0000${project.projectPath}`;
}

export function openWorksetDetailScene(name: string): WorksetPickerScene {
  return { kind: 'detail', name };
}

export function backToWorksetListScene(): WorksetPickerScene {
  return { kind: 'list' };
}

/**
 * Open the creation form. The current Project is seeded as the first member —
 * the implicit Primary — and can never be removed in this Project-first flow.
 */
export function openWorksetCreateScene(project: ProjectContext): WorksetPickerScene {
  return {
    kind: 'create',
    draft: { name: '', members: [project.projectPath], tool: '' },
  };
}

/**
 * Coarse webview-side eligibility check for a member path echoed back by the
 * Host. It only rejects obviously forged values (non-strings, empty, relative
 * paths); authoritative canonicalization stays a Host responsibility.
 */
export function isEligibleWorksetMemberPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Posix absolute, Windows drive absolute, or UNC path.
  return trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\');
}

/**
 * Merge picker-returned paths into the draft: one entry per canonical path,
 * existing order preserved (the first member stays the Primary unless
 * promoted), duplicates skipped, ineligible values rejected with a flag so the
 * form can explain the rejection without touching the draft.
 */
export function mergePickedWorksetMembers(
  draft: WorksetCreateDraft,
  paths: readonly unknown[],
): { draft: WorksetCreateDraft; droppedInvalid: boolean } {
  const members = [...draft.members];
  let droppedInvalid = false;
  for (const candidate of paths) {
    if (!isEligibleWorksetMemberPath(candidate)) {
      if (candidate !== undefined && candidate !== null) droppedInvalid = true;
      continue;
    }
    if (!members.includes(candidate)) members.push(candidate);
  }
  return { draft: { ...draft, members }, droppedInvalid };
}

/**
 * Promote a member to Primary by moving it to the front. The member stays in
 * the list; the previous order of the remaining members is preserved. Promoting
 * the current Primary or an unknown path is a no-op returning the same draft.
 */
export function promoteWorksetPrimaryMember(
  draft: WorksetCreateDraft,
  memberPath: string,
): WorksetCreateDraft {
  if (!draft.members.includes(memberPath) || draft.members[0] === memberPath) return draft;
  return {
    ...draft,
    members: [memberPath, ...draft.members.filter((member) => member !== memberPath)],
  };
}

/**
 * Remove a member unless it is the locked current Project member. Removing a
 * non-Primary member simply shortens the list; removing the (non-locked)
 * Primary leaves the next member as the implicit Primary.
 */
export function removeWorksetDraftMember(
  draft: WorksetCreateDraft,
  memberPath: string,
  lockedMemberPath: string,
): WorksetCreateDraft {
  if (memberPath === lockedMemberPath) return draft;
  return { ...draft, members: draft.members.filter((member) => member !== memberPath) };
}

/**
 * Normalize the draft for submission: the name must be non-empty after trim,
 * members are submitted verbatim in order (first = Primary), and an empty tool
 * is omitted. Returns undefined when the draft cannot be submitted at all.
 */
export function normalizeWorksetCreateSubmit(
  draft: WorksetCreateDraft,
): { name: string; members: readonly string[]; tool?: string } | undefined {
  const name = draft.name.trim();
  if (!name) return undefined;
  const members = draft.members.filter(isEligibleWorksetMemberPath);
  if (members.length === 0) return undefined;
  const tool = draft.tool.trim();
  return tool ? { name, members, tool } : { name, members };
}

/**
 * Wire the create-form submit to the Host path: normalize the draft and, only
 * when it is submittable, invoke `onCreateWorkset` exactly once with the
 * ordered members and optional trimmed tool. Returns whether a submission was
 * sent; an unsubmittable draft performs no Host call.
 */
export function runWorksetCreateSubmit(
  draft: WorksetCreateDraft,
  onCreateWorkset: (name: string, members: string[], tool?: string) => void,
): boolean {
  const submission = normalizeWorksetCreateSubmit(draft);
  if (submission === undefined) return false;
  onCreateWorkset(
    submission.name,
    [...submission.members],
    submission.tool,
  );
  return true;
}

/**
 * Apply at most one Host response sequence per message. A picker response is
 * merged only into an ACTIVE create scene; after cancel/back the same response
 * is recorded as consumed without any side effect (late responses are
 * harmless). A create result transitions create → detail(name) only on success
 * AND only when the fresh trusted navigation actually contains that Workset;
 * failure keeps the draft and records a recoverable notice.
 */
export function reconcileWorksetPickerResponses(
  selection: WorksetPickerSelection,
  navigation: ProjectWorksetNavigationData,
  pickedMembers: Readonly<{ seq: number; paths: readonly unknown[]; droppedPaths?: readonly string[] }> | null | undefined,
  createResult: Readonly<{ seq: number; success: boolean; name: string; message?: string }> | null | undefined,
): WorksetPickerSelection {
  let next = selection;
  if (pickedMembers && pickedMembers.seq !== next.appliedPickedSeq) {
    if (next.scene.kind === 'create') {
      const merged = mergePickedWorksetMembers(next.scene.draft, pickedMembers.paths);
      // Host-dropped picks (unrealpath-able folders) get the same recoverable
      // explanation as webview-rejected values: they were not added.
      const hostDropped = (pickedMembers.droppedPaths?.length ?? 0) > 0;
      next = {
        ...next,
        scene: { kind: 'create', draft: merged.draft },
        appliedPickedSeq: pickedMembers.seq,
        createNotice: merged.droppedInvalid || hostDropped ? { kind: 'invalidMembers' } : undefined,
      };
    } else {
      // Late response after leaving the create form: consume it silently so it
      // can never resurface, but leave the scene and draft untouched.
      next = { ...next, appliedPickedSeq: pickedMembers.seq };
    }
  }
  if (createResult && createResult.seq !== next.appliedResultSeq) {
    next = { ...next, appliedResultSeq: createResult.seq };
    if (next.scene.kind === 'create') {
      if (
        createResult.success
        && createResult.name
        && navigation.worksets.some((workset) => workset.name === createResult.name)
      ) {
        next = { ...next, scene: { kind: 'detail', name: createResult.name }, createNotice: undefined };
      } else if (!createResult.success) {
        next = {
          ...next,
          createNotice: { kind: 'createFailed', message: createResult.message },
        };
      }
      // A success whose name is missing from the fresh navigation is never
      // fabricated into a detail: the create scene simply stays put.
    }
  }
  return next;
}

/**
 * Commit-level Project identity reset for the persisted selection. The reset
 * must be persistent state, not a per-render derivation: A → B → A must land
 * on the plain list, so returning to a previously visited Project can never
 * revive its old detail scene or opener editor.
 */
export function resetWorksetPickerSelectionForProject(
  selection: WorksetPickerSelection,
  projectKey: string,
): WorksetPickerSelection {
  return selection.projectKey === projectKey
    ? selection
    : { projectKey, scene: { kind: 'list' }, openerEditor: null };
}

/**
 * The one-time opener editor is scoped to its detail target: leaving the
 * detail (Back, stale reset, Project change) or entering another Workset
 * closes it; the form element itself stays mounted (so the toggle's
 * aria-controls id always resolves) while the open-state key remount discards
 * the typed id.
 */
export function isWorksetOpenerEditorOpen(
  openerEditor: WorksetOneTimeOpenerEditorState | null,
  detailName: string | undefined,
): boolean {
  return detailName !== undefined && openerEditor?.worksetName === detailName;
}

/**
 * Coordinate a persisted scene with a fresh trusted navigation snapshot:
 * - Project identity change resets to the plain list (no stale notice).
 * - A detail whose Workset still exists is kept (ordinary and binding-only
 *   refreshes must not clear it).
 * - A create scene is preserved while the current Project identity is
 *   unchanged: a normal refresh never discards the user's draft.
 * - A detail whose Workset disappeared returns to the list with a recoverable
 *   stale-item notice; no action of the removed Workset is retained.
 */
export function resolveWorksetPickerScene(
  scene: WorksetPickerScene,
  sceneProjectKey: string,
  navigation: ProjectWorksetNavigationData,
): WorksetPickerScene {
  if (worksetPickerProjectKey(navigation.project) !== sceneProjectKey) {
    return { kind: 'list' };
  }
  if (scene.kind === 'detail') {
    return navigation.worksets.some((workset) => workset.name === scene.name)
      ? scene
      : { kind: 'list', staleDetailName: scene.name };
  }
  return scene;
}

/**
 * Stable heading id for the Workset detail surface. Raw Workset names may
 * contain spaces or other characters that are illegal inside an id (an
 * aria-labelledby idref list splits on whitespace), so runs of unsafe
 * characters collapse to single dashes. Only one detail renders at a time and
 * the heading lives inside the same section as the aria-labelledby reference,
 * so the pair stays unambiguous even for names that slugify identically.
 */
export function worksetDetailHeadingId(name: string): string {
  const slug = name
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `workset-detail-${slug}`;
}

/**
 * Whole-Workset open action. It must remain independent from row/detail
 * activation, so it stops propagation before performing exactly one open.
 * The optional tool is a one-time override; it never mutates the saved tool.
 */
export function runWorksetOpenAction(
  name: string,
  open: (name: string, tool?: string) => void,
  event?: { stopPropagation?: () => void },
  tool?: string,
): void {
  event?.stopPropagation?.();
  if (tool === undefined) {
    open(name);
    return;
  }
  open(name, tool);
}

/**
 * A one-time opener id is submitted as-is after trimming; the CLI validates it.
 * The UI only rejects empty values and never pretends a custom id is verified.
 */
export function normalizeOneTimeOpenerTool(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

// Focus idiom mirrors Dashboard.tsx: a visible focus-visible outline colored
// by the theme focus token (no Tailwind default-blue ring, no dead inline
// outlineColor). Animations stay within the 120-160ms color-transition budget
// and are globally disabled under `prefers-reduced-motion` (see index.css).
const focusRing = 'focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]';
const secondaryButtonClass = `rounded transition-colors duration-150 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] ${focusRing}`;
const primaryButtonClass = `rounded transition-colors duration-150 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] ${focusRing}`;
const descriptionStyle = { color: 'var(--vscode-descriptionForeground)' } as const;
const inputClass = `w-full min-w-0 rounded px-2 py-1 text-xs ${focusRing}`;
const inputStyle = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
} as const;

/**
 * Best-effort visible git identity for a Workset member: the repository's
 * basename and the branch, joined compactly so a ~430px row can show both.
 * The full repository path stays in the row tooltip.
 */
export function formatWorksetMemberGitLabel(
  git: Readonly<{ repository?: string; branch?: string }> | undefined,
): string {
  if (!git) return '';
  const segments: string[] = [];
  if (git.repository) {
    const normalized = git.repository.replace(/[\\/]+$/, '');
    const lastSlash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
    const basename = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
    if (basename) segments.push(basename);
  }
  if (git.branch) segments.push(git.branch);
  return segments.join(' \u00b7 ');
}

export interface WorksetOneTimeOpenerFormProps {
  name: string;
  onOpen: (name: string, tool: string) => void;
  /**
   * Collapsed disclosure state. The form stays mounted so the toggle button's
   * aria-controls id always resolves to a real element; the hidden attribute
   * removes it from layout, tab order, and the accessibility tree. The flex
   * layout utility is dropped while hidden so no author display rule can
   * override the attribute's native display:none.
   */
  hidden?: boolean;
}

/**
 * Editable one-time opener: free-form id input with `code`/`cursor` shortcuts.
 * The entered id is passed to the CLI verbatim (trimmed); the saved Workset
 * tool is never modified by this control.
 */
export const WorksetOneTimeOpenerForm: React.FC<WorksetOneTimeOpenerFormProps> = ({ name, onOpen, hidden }) => {
  const [toolId, setToolId] = useState('');
  const submit = () => {
    const normalized = normalizeOneTimeOpenerTool(toolId);
    if (normalized === undefined) return;
    onOpen(name, normalized);
  };

  return (
    <form
      id="workset-one-time-opener-form"
      data-one-time-opener-form
      hidden={hidden}
      className={hidden ? 'mt-1 min-w-0' : 'mt-1 flex min-w-0 flex-wrap items-center gap-1'}
      onSubmit={(event) => {
        // Enter in the input performs exactly one open; preventDefault keeps
        // the webview free of page-reload semantics.
        event.preventDefault();
        submit();
      }}
    >
      <input
        type="text"
        value={toolId}
        onChange={(event) => setToolId(event.target.value)}
        aria-label={t('worksetNavigation.oneTimeOpenerLabel')}
        title={t('worksetNavigation.oneTimeOpenerLabel')}
        placeholder={t('worksetNavigation.oneTimeOpenerLabel')}
        className={`min-w-0 flex-1 rounded px-2 py-1 text-xs ${focusRing}`}
        style={inputStyle}
      />
      {(['code', 'cursor'] as const).map((shortcut) => (
        <button
          key={shortcut}
          type="button"
          data-one-time-tool-shortcut={shortcut}
          onClick={() => setToolId(shortcut)}
          aria-label={t('worksetNavigation.toolShortcut', { tool: shortcut })}
          title={t('worksetNavigation.toolShortcut', { tool: shortcut })}
          className={`shrink-0 px-2 py-1 text-xs ${secondaryButtonClass}`}
        >
          {shortcut}
        </button>
      ))}
      {/* Click and Enter both submit the form exactly once: the button is the
          form's submit control and carries no separate click handler. */}
      <button
        type="submit"
        data-action="open-with-one-time-tool"
        aria-label={t('worksetNavigation.oneTimeOpenerSubmit')}
        title={t('worksetNavigation.oneTimeOpenerSubmit')}
        className={`shrink-0 px-2 py-1 text-xs ${primaryButtonClass}`}
      >
        {t('worksetNavigation.oneTimeOpenerSubmit')}
      </button>
    </form>
  );
};

function isCurrentProject(navigation: ProjectWorksetNavigationData, member: WorksetNavigationMember): boolean {
  return member.project?.id === navigation.project.id || member.path === navigation.project.projectPath;
}

export interface WorksetCreateFormProps {
  draft: WorksetCreateDraft;
  /** Canonical path of the current Project member; never removable. */
  lockedMemberPath: string;
  /** Recoverable feedback text; undefined renders no notice. */
  noticeText?: string;
  onDraftChange: (draft: WorksetCreateDraft) => void;
  onPickMembers: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Single-screen creation form. The members list is ordered: the first entry is
 * the Primary (submitted first). The current Project member is displayed as a
 * locked state text — it is included by construction and offers no remove
 * control. Cancel is a pure local scene switch; only the submit control sends
 * a creation message, and it stays disabled until the trimmed name is valid.
 */
export const WorksetCreateForm: React.FC<WorksetCreateFormProps> = ({
  draft,
  lockedMemberPath,
  noticeText,
  onDraftChange,
  onPickMembers,
  onSubmit,
  onCancel,
}) => {
  const primaryPath = draft.members[0];
  const submitDisabled = draft.name.trim() === '';

  return (
    <form
      data-workset-create-form
      className="space-y-2 rounded border p-2"
      style={{ borderColor: 'var(--vscode-panel-border)' }}
      aria-label={t('worksetCreate.formLabel')}
      onSubmit={(event) => {
        // Enter in any input performs at most one submission; preventDefault
        // keeps the webview free of page-reload semantics.
        event.preventDefault();
        if (!submitDisabled) onSubmit();
      }}
    >
      <div className="min-w-0 space-y-1">
        <label
          htmlFor="workset-create-name"
          className="block text-xs font-semibold"
          style={descriptionStyle}
        >
          {t('worksetCreate.nameLabel')}
        </label>
        <input
          id="workset-create-name"
          type="text"
          data-create-workset-name
          value={draft.name}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
          aria-label={t('worksetCreate.nameLabel')}
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="text-xs font-semibold" style={descriptionStyle}>
            {t('worksetCreate.membersLabel')}
          </span>
          <span className="min-w-0 truncate text-[10px]" style={descriptionStyle}>
            {t('worksetCreate.primaryHint')}
          </span>
        </div>
        <div
          data-workset-create-members
          className="divide-y divide-[color:var(--vscode-panel-border)] rounded border"
          style={{ borderColor: 'var(--vscode-panel-border)' }}
        >
          {draft.members.map((member) => {
            const locked = member === lockedMemberPath;
            const primary = member === primaryPath;
            return (
              <div
                key={member}
                data-create-member={member}
                data-create-member-primary={primary ? 'true' : undefined}
                data-create-member-state={locked ? 'current-project' : undefined}
                className="flex min-w-0 items-center justify-between gap-2 px-2 py-1 text-xs"
                title={member}
                style={locked ? { ...descriptionStyle } : undefined}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span aria-hidden="true" className="codicon codicon-folder shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{member}</span>
                </span>
                {locked && (
                  <span className="shrink-0" style={descriptionStyle}>
                    {t('worksetCreate.currentProjectMember')}
                  </span>
                )}
                {primary && (
                  <span
                    className="shrink-0 rounded px-1"
                    data-create-primary-badge
                    style={{ ...descriptionStyle }}
                  >
                    {t('worksetCreate.primaryBadge')}
                  </span>
                )}
                {!primary && (
                  <button
                    type="button"
                    data-action="promote-create-primary"
                    onClick={() => onDraftChange(promoteWorksetPrimaryMember(draft, member))}
                    aria-label={t('worksetCreate.makePrimaryAria', { name: member })}
                    title={t('worksetCreate.makePrimaryAria', { name: member })}
                    className={`shrink-0 px-1.5 py-0.5 ${secondaryButtonClass}`}
                  >
                    {t('worksetCreate.makePrimary')}
                  </button>
                )}
                {!locked && (
                  <button
                    type="button"
                    data-action="remove-create-member"
                    onClick={() => onDraftChange(removeWorksetDraftMember(draft, member, lockedMemberPath))}
                    aria-label={t('worksetCreate.removeMemberAria', { name: member })}
                    title={t('worksetCreate.removeMemberAria', { name: member })}
                    className={`shrink-0 px-1.5 py-0.5 ${secondaryButtonClass}`}
                  >
                    {t('worksetCreate.removeMember')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          data-action="pick-workset-members"
          onClick={onPickMembers}
          aria-label={t('worksetCreate.addMembers')}
          title={t('worksetCreate.addMembers')}
          className={`w-full px-2 py-1 text-xs ${secondaryButtonClass}`}
        >
          {t('worksetCreate.addMembers')}
        </button>
      </div>

      <div className="min-w-0 space-y-1">
        <label
          htmlFor="workset-create-tool"
          className="block text-xs font-semibold"
          style={descriptionStyle}
        >
          {t('worksetCreate.toolLabel')}
        </label>
        <input
          id="workset-create-tool"
          type="text"
          data-create-workset-tool
          value={draft.tool}
          onChange={(event) => onDraftChange({ ...draft, tool: event.target.value })}
          aria-label={t('worksetCreate.toolLabel')}
          className={inputClass}
          style={inputStyle}
        />
        <p className="text-[10px]" style={descriptionStyle}>
          {t('worksetCreate.toolHint')}
        </p>
      </div>

      {noticeText !== undefined && (
        <div
          role="status"
          data-create-notice
          className="text-xs leading-snug"
          style={{ color: 'var(--vscode-errorForeground)' }}
        >
          {noticeText}
        </div>
      )}

      <div className="space-y-1">
        {/* Visual acceptance D1: the native disabled attribute alone leaves the
            saturated --vscode-button-background intact in dark/light (High
            Contrast grays disabled buttons by itself). The disabled-variant
            muting idiom shared with ChangePagination (opacity + no-click
            cursor) conveys the state in every theme while the control stays a
            native disabled submit. */}
        <button
          type="submit"
          data-action="submit-create-workset"
          disabled={submitDisabled}
          aria-label={t('worksetCreate.submit')}
          title={t('worksetCreate.submit')}
          className={`w-full px-2 py-1 text-xs ${primaryButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {t('worksetCreate.submit')}
        </button>
        <button
          type="button"
          data-action="cancel-create-workset"
          onClick={onCancel}
          aria-label={t('worksetCreate.cancel')}
          title={t('worksetCreate.cancel')}
          className={`w-full px-2 py-1 text-xs ${secondaryButtonClass}`}
        >
          {t('worksetCreate.cancel')}
        </button>
      </div>
    </form>
  );
};

export const WorksetProjectPicker: React.FC<WorksetProjectPickerProps> = ({
  navigation,
  activeStoreId,
  explicitStoreSelector,
  onSelectProject,
  onSelectWorksetStore,
  onSelectProjectDefaultRoot,
  onOpenWorkset,
  onPickMembers,
  onCreateWorkset,
  onBackToCurrentProject,
  pickedMembers,
  createResult,
  initialScene,
  initialOpenerOpen,
  createAvailable,
}) => {
  const [selection, setSelection] = useState<WorksetPickerSelection>(() => ({
    projectKey: worksetPickerProjectKey(navigation.project),
    scene: initialScene ?? { kind: 'list' },
    openerEditor: initialOpenerOpen && initialScene?.kind === 'detail'
      ? { worksetName: initialScene.name }
      : null,
  }));
  // Persistent Project-identity reset: committing the reset to state (not
  // deriving it per render) means A → B → A cannot revive A's old detail.
  // Render-phase commit, the same idiom as the Dashboard's view-state restore.
  const projectKey = worksetPickerProjectKey(navigation.project);
  const resetSelection = resetWorksetPickerSelectionForProject(selection, projectKey);
  // Sequence-stamped Host responses apply at most once each, and picker
  // responses apply only while the create scene is active. Also committed in
  // the render phase so the whole reconciliation stays pure and DOM-less.
  const committedSelection = reconcileWorksetPickerResponses(
    resetSelection,
    navigation,
    pickedMembers,
    createResult,
  );
  if (committedSelection !== selection) {
    setSelection(committedSelection);
  }
  // Pure per-render coordination with the latest trusted snapshot. The state
  // itself only changes through user activation or response application, so no
  // router, global store, or persistence is involved.
  const scene = resolveWorksetPickerScene(committedSelection.scene, committedSelection.projectKey, navigation);
  // Scene switches are user-initiated: applied-response sequences stay recorded
  // (an old response must not re-apply after cancel/back), stale notices drop.
  const selectScene = (next: WorksetPickerScene) => setSelection((previous) => ({
    ...previous,
    scene: next,
    openerEditor: null,
    createNotice: undefined,
  }));
  const detail = scene.kind === 'detail'
    ? navigation.worksets.find((workset) => workset.name === scene.name)
    : undefined;
  const openerEditorOpen = isWorksetOpenerEditorOpen(committedSelection.openerEditor, detail?.name);
  const toggleOpenerEditor = () => {
    if (detail === undefined) return;
    setSelection({
      ...committedSelection,
      openerEditor: openerEditorOpen ? null : { worksetName: detail.name },
    });
  };
  const updateCreateDraft = (draft: WorksetCreateDraft) => {
    setSelection((previous) => (
      previous.scene.kind === 'create'
        ? { ...previous, scene: { kind: 'create', draft }, createNotice: undefined }
        : previous
    ));
  };
  const submitCreateWorkset = () => {
    if (scene.kind !== 'create') return;
    // A fresh submit drops the previous failure notice; the draft itself is
    // sent verbatim (normalized) and only cleared by an explicit success
    // transition. An unsubmittable draft performs no Host call.
    setSelection((previous) => ({ ...previous, createNotice: undefined }));
    runWorksetCreateSubmit(scene.draft, onCreateWorkset);
  };
  const createNoticeText = committedSelection.createNotice === undefined
    ? undefined
    : committedSelection.createNotice.kind === 'invalidMembers'
      ? t('worksetCreate.invalidMemberNotice')
      : committedSelection.createNotice.message ?? t('worksetCreate.createFailedDefault');

  return (
    <section className="mb-6" data-workset-project-picker data-workset-picker-scene>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={descriptionStyle}
          >
            {t('worksetNavigation.title')}
          </div>
          <h2 className="truncate text-base font-semibold" title={navigation.project.label}>
            {navigation.project.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onBackToCurrentProject}
          aria-label={t('worksetNavigation.returnCurrent')}
          title={t('worksetNavigation.returnCurrent')}
          className={`shrink-0 px-2 py-1 text-xs ${secondaryButtonClass}`}
        >
          {t('worksetNavigation.returnCurrent')}
        </button>
      </div>

      {scene.kind === 'list' && scene.staleDetailName !== undefined && (
        <div
          role="status"
          data-workset-stale-notice
          className="mb-3 text-xs"
          style={descriptionStyle}
        >
          {t('worksetNavigation.staleDetailNotice', { name: scene.staleDetailName })}
        </div>
      )}

      <div data-workset-scene={scene.kind} className="space-y-2">
        {detail ? (
          <section
            data-workset-detail={detail.name}
            className="rounded border p-2"
            style={{ borderColor: 'var(--vscode-panel-border)' }}
            aria-labelledby={worksetDetailHeadingId(detail.name)}
          >
            <div className="mb-2 min-w-0">
              <button
                type="button"
                data-action="back-to-worksets"
                onClick={() => selectScene(backToWorksetListScene())}
                aria-label={t('worksetNavigation.backToList')}
                title={t('worksetNavigation.backToList')}
                className={`px-2 py-1 text-xs ${secondaryButtonClass}`}
              >
                {/* The arrow glyph is decorative: hidden from assistive tech so
                    only the translated label is announced. */}
                <span aria-hidden="true" className="mr-1">←</span>
                {t('worksetNavigation.backToList')}
              </button>
              <h3
                id={worksetDetailHeadingId(detail.name)}
                className="mt-2 truncate text-sm font-semibold"
                title={detail.name}
              >
                {detail.name}
              </h3>
              <div className="truncate text-xs" style={descriptionStyle}>
                {detail.tool
                  ? t('worksetNavigation.savedTool', { tool: detail.tool })
                  : t('worksetNavigation.defaultTool')}
              </div>
            </div>

            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-1">
              <button
                type="button"
                data-action="open-workset"
                onClick={(event) => runWorksetOpenAction(detail.name, onOpenWorkset, event)}
                aria-label={t('worksetsPage.openWholeWorkset', { name: detail.name })}
                title={t('worksetsPage.openWholeWorkset', { name: detail.name })}
                className={`px-2 py-1 text-xs ${primaryButtonClass}`}
              >
                {t('worksetNavigation.openAll')}
              </button>
              <button
                type="button"
                data-action="reveal-one-time-opener"
                onClick={toggleOpenerEditor}
                aria-label={t('worksetNavigation.openWithTool')}
                title={t('worksetNavigation.openWithTool')}
                aria-expanded={openerEditorOpen}
                aria-controls="workset-one-time-opener-form"
                className={`px-2 py-1 text-xs ${secondaryButtonClass}`}
              >
                {t('worksetNavigation.openWithTool')}
              </button>
            </div>

            {/* Always-mounted disclosure: the toggle's aria-controls id
                resolves in both states, and the open state is part of the key
                so any close (toggle, Back, Workset switch) remounts the form
                and discards the typed id exactly as the previous unmount-on-
                collapse did. */}
            <WorksetOneTimeOpenerForm
              key={`${detail.name}:${openerEditorOpen ? 'open' : 'closed'}`}
              name={detail.name}
              hidden={!openerEditorOpen}
              onOpen={(name, tool) => runWorksetOpenAction(name, onOpenWorkset, undefined, tool)}
            />

            <div
              className="mb-2 flex min-w-0 items-baseline justify-between gap-2"
              data-workset-members-section
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={descriptionStyle}
              >
                {t('worksetNavigation.membersSection')}
              </span>
              <span className="min-w-0 truncate text-xs" style={descriptionStyle}>
                {t('worksetsPage.memberCount', { count: String(detail.members.length) })}
              </span>
            </div>
            <div
              className="divide-y divide-[color:var(--vscode-panel-border)]"
              data-workset-members={detail.name}
            >
              {detail.members.map((member) => {
                const current = member.role === 'project' && isCurrentProject(navigation, member);
                const currentRoot = member.role === 'store'
                  && activeStoreId !== undefined
                  && member.storeId === activeStoreId;
                const selectable = member.role === 'project'
                  && member.selectable
                  && Boolean(member.project)
                  && !current;
                const memberIcon = member.role === 'store'
                  ? 'codicon-library'
                  : 'codicon-folder';
                const gitLabel = formatWorksetMemberGitLabel(member.git);

                if (selectable) {
                  return (
                    <button
                      key={`${detail.name}:${member.path}`}
                      type="button"
                      data-workset-project={member.path}
                      onClick={() => onSelectProject(detail.name, member.path)}
                      aria-label={t('worksetNavigation.switchProject', { name: member.name })}
                      title={member.path}
                      className={`flex w-full min-w-0 items-start justify-between gap-2 px-2 py-1.5 text-left text-xs ${focusRing} transition-colors duration-150 hover:bg-[var(--vscode-list-hoverBackground)]`}
                    >
                      <span className="flex min-w-0 flex-1 items-start gap-1.5">
                        <span aria-hidden="true" className={`codicon ${memberIcon} shrink-0`} />
                        <span className="flex min-w-0 flex-col">
                          <span className="min-w-0 truncate">{member.name}</span>
                          {gitLabel && (
                            <span
                              className="min-w-0 truncate text-[10px]"
                              title={member.git?.repository ?? member.git?.branch}
                              style={descriptionStyle}
                            >
                              {gitLabel}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0">{t('worksetNavigation.switchProjectShort')}</span>
                    </button>
                  );
                }

                if (member.role === 'store' && !currentRoot) {
                  return (
                    <button
                      key={`${detail.name}:${member.path}`}
                      type="button"
                      data-workset-store={member.storeId}
                      data-action="use-planning-root"
                      onClick={() => onSelectWorksetStore(detail.name, member.path)}
                      aria-label={t('worksetNavigation.useAsPlanningRootAria', { name: member.name })}
                      title={member.path}
                      className={`flex w-full min-w-0 items-start justify-between gap-2 px-2 py-1.5 text-left text-xs ${focusRing} transition-colors duration-150 hover:bg-[var(--vscode-list-hoverBackground)]`}
                    >
                      <span className="flex min-w-0 flex-1 items-start gap-1.5">
                        <span aria-hidden="true" className={`codicon ${memberIcon} shrink-0`} />
                        <span className="flex min-w-0 flex-col">
                          <span className="min-w-0 truncate">{member.name}</span>
                          <span className="min-w-0 truncate text-[10px]">
                            {t('worksetNavigation.planningStore')}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0">{t('worksetNavigation.useAsPlanningRoot')}</span>
                    </button>
                  );
                }

                return (
                  <div
                    key={`${detail.name}:${member.path}`}
                    data-workset-store={member.role === 'store' ? member.storeId : undefined}
                    data-workset-member-state={
                      currentRoot ? 'current-root' : current ? 'current' : undefined
                    }
                    className="flex min-w-0 items-start justify-between gap-2 px-2 py-1.5 text-xs"
                    title={member.path}
                    style={descriptionStyle}
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-1.5">
                      <span aria-hidden="true" className={`codicon ${memberIcon} shrink-0`} />
                      <span className="flex min-w-0 flex-col">
                        <span className="min-w-0 truncate">{member.name}</span>
                        {member.role === 'store' && (
                          <span className="min-w-0 truncate text-[10px]">
                            {t('worksetNavigation.planningStore')}
                          </span>
                        )}
                        {gitLabel && (
                          <span
                            className="min-w-0 truncate text-[10px]"
                            title={member.git?.repository ?? member.git?.branch}
                          >
                            {gitLabel}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {currentRoot
                        ? t('worksetNavigation.currentRoot')
                        : member.role === 'store'
                          ? t('worksetNavigation.planningStore')
                          : current
                            ? t('worksetNavigation.current')
                            : t('worksetNavigation.unavailable')}
                    </span>
                  </div>
                );
              })}
            </div>

            {explicitStoreSelector === true && (
              <div className="mt-2" data-planning-root-context>
                <button
                  type="button"
                  data-action="use-project-default"
                  onClick={onSelectProjectDefaultRoot}
                  aria-label={t('worksetNavigation.useProjectDefault')}
                  title={t('worksetNavigation.useProjectDefault')}
                  className={`px-2 py-1 text-xs ${secondaryButtonClass}`}
                >
                  {t('worksetNavigation.useProjectDefault')}
                </button>
              </div>
            )}

            {detail.members.every((member) => (
              member.role !== 'project'
              || !member.selectable
              || !member.project
              || isCurrentProject(navigation, member)
            )) && (
              <p className="mt-2 text-xs" style={descriptionStyle}>
                {t('worksetNavigation.noSelectableProjects')}
              </p>
            )}
          </section>
        ) : scene.kind === 'create' ? (
          <WorksetCreateForm
            draft={scene.draft}
            lockedMemberPath={navigation.project.projectPath}
            noticeText={createNoticeText}
            onDraftChange={updateCreateDraft}
            onPickMembers={onPickMembers}
            onSubmit={submitCreateWorkset}
            onCancel={() => selectScene(backToWorksetListScene())}
          />
        ) : (
          <>
            {/* Create entry (or its capability explanation). Inside the empty
                list the explanation and entry form one bounded group so the
                first-creation affordance reads as a single clear unit. */}
            {(() => {
              const createEntry = createAvailable === false ? (
                // The runtime lacks the Workset capability: the Create entry is
                // hidden and the existing upgrade explanation stays visible.
                // List/detail remain usable for reading existing data.
                <p
                  role="status"
                  data-workset-capability-notice
                  className="text-xs leading-snug"
                  style={descriptionStyle}
                >
                  {t('scope.featureGated.upgradeNotice')}
                </p>
              ) : (
                <button
                  type="button"
                  data-action="create-workset"
                  onClick={() => selectScene(openWorksetCreateScene(navigation.project))}
                  aria-label={t('worksetCreate.createAction')}
                  title={t('worksetCreate.createAction')}
                  className={`w-full px-2 py-1.5 text-xs ${secondaryButtonClass}`}
                >
                  {t('worksetCreate.createAction')}
                </button>
              );
              if (navigation.worksets.length === 0) {
                return (
                  <div
                    data-workset-empty-group
                    className="space-y-2 rounded border p-2"
                    style={{ borderColor: 'var(--vscode-panel-border)' }}
                  >
                    <p
                      data-workset-empty-list
                      className="text-xs"
                      style={descriptionStyle}
                    >
                      {t('worksetCreate.emptyList')}
                    </p>
                    {createEntry}
                  </div>
                );
              }
              return (
                <>
                  <div
                    data-workset-list
                    className="overflow-hidden rounded border"
                    style={{ borderColor: 'var(--vscode-panel-border)' }}
                  >
                    <div className="divide-y divide-[color:var(--vscode-panel-border)]">
                      {navigation.worksets.map((workset) => (
                        <div
                          key={workset.name}
                          className="flex items-stretch justify-between gap-1 transition-colors duration-150 hover:bg-[var(--vscode-list-hoverBackground)]"
                        >
                          <button
                            type="button"
                            data-workset-row={workset.name}
                            onClick={() => selectScene(openWorksetDetailScene(workset.name))}
                            aria-label={t('worksetNavigation.openDetail', { name: workset.name })}
                            className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5 text-left ${focusRing}`}
                          >
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                              <span className="w-full truncate text-sm font-semibold" title={workset.name}>
                                {workset.name}
                              </span>
                              <span
                                className="flex w-full min-w-0 items-center gap-2 text-xs"
                                style={descriptionStyle}
                              >
                                <span className="shrink-0">
                                  {t('worksetsPage.memberCount', { count: String(workset.members.length) })}
                                </span>
                                <span className="min-w-0 truncate" title={workset.tool}>
                                  {workset.tool ?? t('worksetNavigation.defaultTool')}
                                </span>
                              </span>
                            </span>
                            <span aria-hidden="true" className="codicon codicon-chevron-right shrink-0" />
                          </button>
                          <button
                            type="button"
                            data-action="open-workset"
                            onClick={(event) => runWorksetOpenAction(workset.name, onOpenWorkset, event)}
                            aria-label={t('worksetsPage.openWholeWorkset', { name: workset.name })}
                            title={t('worksetsPage.openWholeWorkset', { name: workset.name })}
                            className={`shrink-0 self-center px-2 py-0.5 text-xs ${primaryButtonClass}`}
                          >
                            {t('worksetsPage.openWholeWorksetShort')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-1">{createEntry}</div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </section>
  );
};
