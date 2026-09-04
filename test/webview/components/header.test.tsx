import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header, type HeaderProps } from '../../../src/webview/components/Header';
import { setLocale } from '../../../src/i18n';

type ActionButton = React.ReactElement<HeaderProps & {
  'aria-describedby'?: string;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  'data-project-action'?: string;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}>;

function collectProjectActionButtons(node: React.ReactNode): ActionButton[] {
  if (Array.isArray(node)) return node.flatMap(collectProjectActionButtons);
  if (!React.isValidElement(node)) return [];

  const props = node.props as { children?: React.ReactNode; 'data-project-action'?: string };
  const children = React.Children.toArray(props.children).flatMap(collectProjectActionButtons);
  return node.type === 'button' && props['data-project-action']
    ? [node as ActionButton]
    : children;
}

function collectElements(node: React.ReactNode, predicate: (element: React.ReactElement) => boolean): React.ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((item) => collectElements(item, predicate));
  if (!React.isValidElement(node)) return [];

  const props = node.props as { children?: React.ReactNode };
  return [
    ...(predicate(node) ? [node] : []),
    ...React.Children.toArray(props.children).flatMap((item) => collectElements(item, predicate)),
  ];
}

// Direct-call rendering returns `ReactNode | Promise<ReactNode>` under React 19
// types; Header renders synchronously, so a precise element return type keeps
// every collector call site free of tsc debt.
function createProjectHeader(overrides: Partial<HeaderProps> = {}): React.ReactElement {
  return Header({
    onRefresh: vi.fn(),
    loading: false,
    project: { id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' },
    ...overrides,
  }) as React.ReactElement;
}

describe('Project-first Header', () => {
  afterEach(() => setLocale('en'));

  it('renders the four actions in a narrow, non-tablist launcher', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' }}
        onOpenChanges={vi.fn()}
        onOpenSpecs={vi.fn()}
        onOpenWorksets={vi.fn()}
        activeProjectTab="changes"
      />
    );

    expect(html).toContain('data-project-action-grid');
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain('aria-pressed="true"');
    expect(html.indexOf('data-project-action="changes"')).toBeLessThan(
      html.indexOf('data-project-action="specs"'),
    );
    expect(html.indexOf('data-project-action="specs"')).toBeLessThan(
      html.indexOf('data-project-action="worksets"'),
    );
    expect(html.indexOf('data-project-action="worksets"')).toBeLessThan(
      html.indexOf('data-project-action="dashboard"'),
    );
  });

  it('keeps the Worksets cell visible and disabled when navigation is unavailable', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' }}
        onOpenChanges={vi.fn()}
        onOpenSpecs={vi.fn()}
        activeProjectTab="changes"
      />
    );

    expect(html).toMatch(/data-project-action="worksets"[^>]*disabled/);
    expect(html).toMatch(/No trusted Workset membership|Worksets unavailable/i);
  });

  it('renders four named, bounded card buttons with icons and local selection semantics', () => {
    const header = createProjectHeader({
      onOpenChanges: vi.fn(),
      onOpenSpecs: vi.fn(),
      onOpenWorksets: vi.fn(),
      onOpenDashboard: vi.fn(),
      worksetCount: 2,
      activeProjectTab: 'specs',
    });
    const buttons = collectProjectActionButtons(header);

    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.props['aria-label'])).toEqual([
      'All Changes',
      'Specs',
      'Browse Workset Projects (2)',
      'Dashboard · Open in Editor',
    ]);
    expect(buttons.every((button) => button.props.type === 'button')).toBe(true);
    expect(buttons.every((button) => button.props.className?.includes('min-w-0'))).toBe(true);
    expect(buttons.every((button) => button.props.className?.includes('hover:'))).toBe(true);
    expect(buttons.every((button) => button.props.className?.includes('focus-visible'))).toBe(true);
    expect(buttons.map((button) => button.props['aria-pressed'])).toEqual([false, true, false, undefined]);
    expect(buttons.map((button) => (
      collectElements(button, (element) => (
        typeof (element.props as { className?: unknown }).className === 'string'
        && (element.props as { className: string }).className.includes('codicon-')
      )).length
    ))).toEqual([1, 1, 1, 1]);
    expect(buttons.every((button) => collectElements(button, (element) => (
      Boolean((element.props as { 'data-project-action-supporting'?: string })['data-project-action-supporting'])
    )).length === 1)).toBe(true);

    const dashboard = buttons[3];
    expect(dashboard.props.title).toContain('Dashboard');
    expect(dashboard.props.title).toContain('Editor');
  });

  it('includes an explicit Editor cue in the Dashboard accessible name', () => {
    const header = createProjectHeader({
      onOpenDashboard: vi.fn(),
    });
    const dashboard = collectProjectActionButtons(header).find(
      (button) => button.props['data-project-action'] === 'dashboard',
    );

    expect(dashboard?.props['aria-label']).toContain('Editor');
  });

  it('gives unavailable Worksets a complete reason and prevents navigation', () => {
    const onOpenWorksets = vi.fn();
    // No onOpenWorksets handler: upstream (navigation + capability) decided the
    // surface is unavailable, so the tab must stay disabled and inert.
    const header = createProjectHeader({
      onOpenChanges: vi.fn(),
      onOpenSpecs: vi.fn(),
      onOpenDashboard: vi.fn(),
      worksetCount: 0,
      activeProjectTab: 'changes',
    });
    const worksets = collectProjectActionButtons(header).find(
      (button) => button.props['data-project-action'] === 'worksets',
    );

    expect(worksets).toBeDefined();
    expect(worksets?.props.disabled).toBe(true);
    expect(worksets?.props['aria-describedby']).toBeDefined();
    expect(worksets?.props.title).toContain('No trusted Workset membership available');
    const reason = collectElements(header, (element) => (
      (element.props as { id?: string }).id === worksets?.props['aria-describedby']
    ));
    expect(reason).toHaveLength(1);
    expect(reason[0].props.children).toContain('No trusted Workset membership available');
    expect(worksets?.props.onClick).toBeUndefined();
    if (worksets && !worksets.props.disabled) worksets.props.onClick?.();
    expect(onOpenWorksets).not.toHaveBeenCalled();
  });

  it('explains a capability-gated Worksets tab with the upgrade notice', () => {
    const header = createProjectHeader({
      worksetsCapabilityAvailable: false,
    });
    const worksets = collectProjectActionButtons(header).find(
      (button) => button.props['data-project-action'] === 'worksets',
    );

    expect(worksets?.props.disabled).toBe(true);
    expect(worksets?.props['aria-describedby']).toBeDefined();
    expect(worksets?.props.title).toContain('Stores and worksets require OpenSpec 1.5.0 or newer.');
    const reason = collectElements(header, (element) => (
      (element.props as { id?: string }).id === worksets?.props['aria-describedby']
    ));
    expect(reason).toHaveLength(1);
    expect((reason[0]?.props as { children?: string } | undefined)?.children)
      .toContain('Stores and worksets require OpenSpec 1.5.0 or newer.');
  });

  it('keeps Worksets available for zero worksets when an open handler exists', () => {
    // Zero worksets is the first-creation case, never an unavailable state:
    // the count must not gate the tab, only the upstream-provided handler does.
    const onOpenWorksets = vi.fn();
    const header = createProjectHeader({
      onOpenWorksets,
      worksetCount: 0,
      worksetsCapabilityAvailable: true,
    });
    const worksets = collectProjectActionButtons(header).find(
      (button) => button.props['data-project-action'] === 'worksets',
    );

    expect(worksets?.props.disabled).toBe(false);
    expect(worksets?.props['aria-describedby']).toBeUndefined();
    expect(worksets?.props.title).toContain('Browse Workset Projects');
    worksets?.props.onClick?.();
    expect(onOpenWorksets).toHaveBeenCalledTimes(1);
  });

  it('opens Dashboard in its Editor route without changing the selected local view', () => {
    const onOpenDashboard = vi.fn();
    const header = createProjectHeader({
      onOpenChanges: vi.fn(),
      onOpenSpecs: vi.fn(),
      onOpenWorksets: vi.fn(),
      onOpenDashboard,
      worksetCount: 1,
      activeProjectTab: 'specs',
    });
    const buttons = collectProjectActionButtons(header);
    const dashboard = buttons.find((button) => button.props['data-project-action'] === 'dashboard');

    expect(dashboard?.props['aria-pressed']).toBeUndefined();
    dashboard?.props.onClick?.();
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);
    expect(buttons.find((button) => button.props['data-project-action'] === 'specs')?.props['aria-pressed'])
      .toBe(true);
  });

  it('keeps project identity and explorer navigation in separate vertical regions', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/long-project', label: 'long-project', projectPath: '/projects/long-project' }}
        binding={{
          projectId: '/projects/long-project',
          commandCwd: '/projects/long-project',
          rootPath: '/projects/long-project',
          rootSource: 'nearest',
        }}
        onOpenChanges={vi.fn()}
        onOpenSpecs={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="Current Project"');
    expect(html).toContain('data-project-identity');
    expect(html).toContain('data-project-navigation');
    expect(html).toContain('Current Project');
    expect(html.indexOf('data-project-identity')).toBeLessThan(html.indexOf('data-project-navigation'));
    expect(html).toContain('data-project-navigation="true"');
    expect(html).toContain('class="flex flex-col gap-1"');
  });

  it('exposes a separate Worksets navigation action without moving Project identity', () => {
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' }}
        onOpenWorksets={vi.fn()}
        worksetCount={1}
      />
    );

    expect(html).toContain('Browse Workset Projects');
    expect(html).toContain('data-project-action="worksets"');
    expect(html).toContain('aria-label="Browse Workset Projects (1)"');
    expect(html).toContain('title="Browse Workset Projects"');
    expect(html.indexOf('data-project-identity')).toBeLessThan(html.indexOf('Browse Workset Projects'));
  });

  it('translates card supporting text and navigation accessible names', () => {
    setLocale('zh-cn');
    const html = renderToStaticMarkup(
      <Header
        onRefresh={vi.fn()}
        onNewChange={vi.fn()}
        loading={false}
        project={{ id: '/projects/current', label: 'Current Project', projectPath: '/projects/current' }}
        onOpenChanges={vi.fn()}
        onOpenSpecs={vi.fn()}
        onOpenDashboard={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="项目导航"');
    expect(html).toContain('浏览本地 Changes');
    expect(html).toContain('浏览本地 Specs');
    expect(html).toContain('在编辑器中打开项目 Dashboard');
    // The Worksets launcher keeps its browsing-for-current-Project accessible
    // name in zh-cn too (short visible label, descriptive accessible name).
    expect(html).toContain('浏览 Workset 项目');
    expect(html).not.toContain('aria-label="Project navigation"');
    expect(html).not.toContain('Browse Workset Projects');
  });
});
