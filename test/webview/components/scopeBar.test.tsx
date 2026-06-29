import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ScopeBar } from '../../../src/webview/components/ScopeBar';

describe('ScopeBar', () => {
  it('shows runtime, scope, and health', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          id: 'store:team-plans',
          label: 'team-plans',
          source: 'store',
          rootPath: '/stores/team-plans',
          storeId: 'team-plans',
          runtimeSource: 'localSource',
        }}
        scopes={[]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).toContain('Local Source');
    expect(html).toContain('team-plans');
    expect(html).toContain('Healthy');
  });

  it('shows scope selector when multiple scopes available', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          id: 'local:/workspace',
          label: 'Local Root',
          source: 'local',
          rootPath: '/workspace',
          runtimeSource: 'installed',
        }}
        scopes={[
          {
            id: 'local:/workspace',
            label: 'Local Root',
            source: 'local',
            rootPath: '/workspace',
            runtimeSource: 'installed',
          },
          {
            id: 'store:team-plans',
            label: 'team-plans',
            source: 'store',
            rootPath: '/stores/team-plans',
            storeId: 'team-plans',
            runtimeSource: 'localSource',
          },
        ]}
        loading={false}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).toContain('<select');
    expect(html).toContain('Local Root');
    expect(html).toContain('team-plans');
  });

  it('returns null when no scope is provided', () => {
    const html = renderToStaticMarkup(
      <ScopeBar scope={undefined} scopes={[]} loading={false} onSelectScope={vi.fn()} />,
    );
    expect(html).toBe('');
  });

  it('disables selector when loading', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          id: 'local:/workspace',
          label: 'Local Root',
          source: 'local',
          rootPath: '/workspace',
          runtimeSource: 'installed',
        }}
        scopes={[
          {
            id: 'local:/workspace',
            label: 'Local Root',
            source: 'local',
            rootPath: '/workspace',
            runtimeSource: 'installed',
          },
          {
            id: 'store:team-plans',
            label: 'team-plans',
            source: 'store',
            rootPath: '/stores/team-plans',
            storeId: 'team-plans',
            runtimeSource: 'localSource',
          },
        ]}
        health={{ status: 'warning', label: 'Issues found' }}
        loading={true}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).toContain('disabled');
    expect(html).toContain('Issues');
  });
});
