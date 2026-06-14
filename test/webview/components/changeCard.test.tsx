import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChangeCard } from '../../../src/webview/components/ChangeCard';
import type { ChangeInfo } from '../../../src/webview/types/messages';

const change: ChangeInfo = {
  name: 'polish-dashboard-change-detail-ui',
  completedTasks: 3,
  totalTasks: 5,
  lastModified: '2026-06-10T12:00:00.000Z',
  createdAt: '2026-06-01T09:00:00.000Z',
  status: 'in-progress',
  artifacts: [
    { id: 'proposal', outputPath: 'proposal.md', status: 'done' },
    { id: 'design', outputPath: 'design.md', status: 'done' },
  ],
  proposalWhySummary: 'Improve dashboard readability.',
  proposalWhyFullText: 'Improve dashboard readability for active changes.',
};

describe('ChangeCard', () => {
  it('renders identity, summary, artifacts, time metadata, and progress', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={change} onClick={vi.fn()} onLaunchWorkflow={vi.fn()} />
    );

    expect(html).toContain('polish-dashboard-change-detail-ui');
    expect(html).toContain('Improve dashboard readability.');
    expect(html).toContain('proposal');
    expect(html).toContain('design');
    expect(html).toContain('Created');
    expect(html).toContain('Updated');
    expect(html).toContain('3 / 5 tasks');
    expect(html).toContain('60%');

    // Tooltip / Title check
    expect(html).toContain('title="Improve dashboard readability for active changes."');

    // Transitions & Focus rings check
    expect(html).toContain('transition-colors');
    expect(html).toContain('focus:outline-none');
    expect(html).toContain('focus:ring-1');
    expect(html).toContain('transition-[width]');
    expect(html).toContain('duration-150');
    expect(html).toContain('ease-out');

    // Default state check: quick actions should not be visible initially
    expect(html).not.toContain('data-action');
  });

  it('hides Created when createdAt is missing', () => {
    const html = renderToStaticMarkup(
      <ChangeCard change={{ ...change, createdAt: undefined }} onClick={vi.fn()} />
    );

    expect(html).not.toContain('Created');
    expect(html).toContain('Updated');
  });
});

