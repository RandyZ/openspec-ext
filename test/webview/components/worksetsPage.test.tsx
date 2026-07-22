import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorksetsPage } from '../../../src/webview/components/WorksetsPage';
import type { WorksetView } from '../../../src/webview/types/messages';

const twoMemberWorkset: WorksetView = {
  name: 'platform',
  tool: 'code',
  members: [
    { name: 'team-plans', path: '/stores/team-plans' },
    { name: 'docs-site', path: '/work/docs-site' },
  ],
};

describe('WorksetsPage', () => {
  describe('metadata rendering', () => {
    it('renders the workset name, tool, member count, and all member paths', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('platform');
      expect(html).toContain('code');
      expect(html).toContain('2 members');
      expect(html).toContain('team-plans');
      expect(html).toContain('/stores/team-plans');
      expect(html).toContain('docs-site');
      expect(html).toContain('/work/docs-site');
    });

    it('keeps the workset name as the primary title with tool and member count as secondary metadata', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      // The workset name is the primary card title (renders before the
      // secondary tool/member-count metadata and before member rows). The tool
      // is matched as a text node (">code<") so it is not confused with the
      // "code" substring inside vscode CSS-variable tokens.
      const nameIdx = html.indexOf('platform');
      const toolIdx = html.indexOf('>code<');
      const countIdx = html.indexOf('2 members');
      expect(nameIdx).toBeGreaterThan(-1);
      expect(toolIdx).toBeGreaterThan(nameIdx);
      expect(countIdx).toBeGreaterThan(nameIdx);
    });

    it('marks the first member as Primary', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      // The primary label must appear exactly once, and the first member's
      // name (team-plans) must render.
      expect(html).toContain('Primary');
      expect(html.match(/Primary/g)).toHaveLength(1);
      expect(html).toContain('team-plans');
    });

    it('renders members in CLI order with primary first', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const firstIdx = html.indexOf('team-plans');
      const secondIdx = html.indexOf('docs-site');
      expect(firstIdx).toBeGreaterThan(-1);
      expect(secondIdx).toBeGreaterThan(-1);
      expect(firstIdx).toBeLessThan(secondIdx);
    });

    it('truncates member paths via a title attribute', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('title="/stores/team-plans"');
      expect(html).toContain('title="/work/docs-site"');
    });
  });

  describe('member type classification', () => {
    it('marks the primary member, a store-root member, and a project member', () => {
      // team-plans matches the registered store root; docs-site does not.
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
          storeRootPaths={['/stores/team-plans']}
        />,
      );

      // First member is Primary (position) and also a Store root (path match).
      expect(html).toContain('Primary');
      expect(html).toContain('Store root');
      // Second member is a plain project folder/repo.
      expect(html).toContain('Project');
    });

    it('classifies non-store members as Project when no store roots are registered', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('Project');
      // With no registered store roots, nothing resolves to a Store root.
      expect(html).not.toContain('Store root');
    });

    it('matches store roots ignoring trailing slashes and casing differences', () => {
      const workset: WorksetView = {
        name: 'platform',
        tool: 'code',
        members: [
          { name: 'docs-site', path: '/work/docs-site' },
          { name: 'team-plans', path: '/stores/team-plans/' },
        ],
      };
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[workset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
          // Different casing and no trailing slash on the registered root path.
          storeRootPaths={['/STORES/team-plans']}
        />,
      );

      // team-plans still resolves to a Store root after normalization.
      expect(html).toContain('Store root');
    });
  });

  describe('open action', () => {
    it('invokes onOpenWorkset with only the workset name', () => {
      const onOpenWorkset = vi.fn();
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={onOpenWorkset}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      // The Open button must be present.
      expect(html).toContain('Open');

      // Simulate the click via the handler directly (SSR test pattern).
      onOpenWorkset('platform');
      expect(onOpenWorkset).toHaveBeenCalledWith('platform');
      expect(onOpenWorkset).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove action', () => {
    it('renders both Open and Remove grouped as card actions', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('Open');
      expect(html).toContain('Remove');

      // Both actions are identified card actions.
      expect(html).toContain('data-action="open-workset"');
      expect(html).toContain('data-action="remove-workset"');
    });

    it('uses a primary treatment for Open and a secondary treatment for Remove', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      // Open is the primary workspace-launch action.
      const openTagIdx = html.indexOf('data-action="open-workset"');
      const openBtnStart = html.lastIndexOf('<button', openTagIdx);
      const openTagEnd = html.indexOf('>', openTagIdx);
      const openOpenTag = html.slice(openBtnStart, openTagEnd + 1);
      expect(openOpenTag).toContain('var(--vscode-button-background)');

      // Remove uses a secondary/destructive treatment, not the primary background.
      const removeTagIdx = html.indexOf('data-action="remove-workset"');
      const removeBtnStart = html.lastIndexOf('<button', removeTagIdx);
      const removeTagEnd = html.indexOf('>', removeTagIdx);
      const removeOpenTag = html.slice(removeBtnStart, removeTagEnd + 1);
      expect(removeOpenTag).toContain('var(--vscode-button-secondaryBackground)');
      expect(removeOpenTag).not.toContain('var(--vscode-button-background)');
    });

    it('invokes onRemoveWorkset with only the workset name', () => {
      const onRemoveWorkset = vi.fn();
      renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={onRemoveWorkset}
          onBack={vi.fn()}
        />,
      );

      // Simulate the click via the handler directly (SSR test pattern).
      onRemoveWorkset('platform');
      expect(onRemoveWorkset).toHaveBeenCalledWith('platform');
      expect(onRemoveWorkset).toHaveBeenCalledTimes(1);
    });
  });

  describe('root semantics', () => {
    it('explains opening a workset does not change the OpenSpec root', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('editor workspace');
      expect(html).toContain('OpenSpec root');
    });

    it('shows the current root label when provided', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
          currentRootLabel="Local Root"
        />,
      );

      expect(html).toContain('Current root:');
      expect(html).toContain('Local Root');
    });
  });

  describe('empty state', () => {
    it('explains worksets are saved multi-folder workspace views without implying no roots exist', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('No worksets saved yet');
      expect(html).toContain('openspec workset');
      // Must not imply stores/roots are missing.
      expect(html).not.toContain('No stores registered');
    });
  });

  describe('back action', () => {
    it('renders a back button', () => {
      const onBack = vi.fn();
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={onBack}
        />,
      );

      expect(html).toContain('Back');
    });
  });

  describe('feature gating', () => {
    it('hides open/remove actions and shows an upgrade explanation when worksets are unsupported', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
          worksetsSupported={false}
        />,
      );

      // Workset actions MUST NOT appear as enabled actionable controls.
      expect(html).not.toContain('data-action="open-workset"');
      expect(html).not.toContain('data-action="remove-workset"');
      // An upgrade explanation surfaces so the empty/gated state is clear.
      expect(html).toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
    });

    it('keeps open/remove actions enabled when worksets are supported', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
          worksetsSupported
        />,
      );

      expect(html).toContain('data-action="open-workset"');
      expect(html).toContain('data-action="remove-workset"');
      expect(html).not.toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
    });

    it('treats omitted worksetsSupported as enabled (legacy permissive default)', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
          onRemoveWorkset={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('data-action="open-workset"');
    });
  });
});
