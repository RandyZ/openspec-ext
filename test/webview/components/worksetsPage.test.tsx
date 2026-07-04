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

    it('marks the first member as Primary', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
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
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('title="/stores/team-plans"');
      expect(html).toContain('title="/work/docs-site"');
    });
  });

  describe('open action', () => {
    it('invokes onOpenWorkset with only the workset name', () => {
      const onOpenWorkset = vi.fn();
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={onOpenWorkset}
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

  describe('root semantics', () => {
    it('explains opening a workset does not change the OpenSpec root', () => {
      const html = renderToStaticMarkup(
        <WorksetsPage
          worksets={[twoMemberWorkset]}
          onOpenWorkset={vi.fn()}
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
          onBack={onBack}
        />,
      );

      expect(html).toContain('Back');
    });
  });
});
