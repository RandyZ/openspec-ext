import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ScopeBar } from '../../../src/webview/components/ScopeBar';
import type { CacheStatsView, OpenSpecScopeView } from '../../../src/webview/types/messages';

const localScope: OpenSpecScopeView = {
  id: 'local:/workspace',
  label: 'Local Root',
  source: 'local',
  rootPath: '/workspace',
  runtimeSource: 'installed',
};

const storeScope: OpenSpecScopeView = {
  id: 'store:team-plans',
  label: 'team-plans',
  source: 'store',
  rootPath: '/stores/team-plans',
  storeId: 'team-plans',
  runtimeSource: 'localSource',
};

const declaredScope: OpenSpecScopeView = {
  id: 'declared:/other-project',
  label: 'other-project',
  source: 'declared',
  rootPath: '/other-project',
  runtimeSource: 'installed',
};

const cacheStats: CacheStatsView = {
  rootPath: '/workspace/.openspec-cache',
  totalBytes: 12288,
  formattedSize: '12 KB',
  fileCount: 4,
  calculatedAt: 1,
  isCalculating: false,
};

describe('ScopeBar', () => {
  it('renders a compact operational rail instead of a heavy card', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={storeScope}
        scopes={[localScope, storeScope]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={cacheStats}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    expect(html).toContain('Local Source');
    expect(html).toContain('team-plans');
    expect(html).toContain('Healthy');
    expect(html).toContain('Cache 12 KB');
    expect(html).toContain('aria-label="Cache actions"');
    expect(html).not.toContain('editor-inactiveSelectionBackground');
  });

  it('does not own the root selector; the selector lives in the primary action rail', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={localScope}
        scopes={[localScope, storeScope]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={cacheStats}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    // The root selector has moved into the Header action rail; the ScopeBar is
    // now strictly the CLI/cache status row and MUST NOT render a selector.
    expect(html).not.toContain('<select');
    expect(html).not.toContain('aria-label="OpenSpec Root"');
  });

  it('renders accessible cache action controls behind a menu trigger', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={storeScope}
        scopes={[localScope, storeScope]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={cacheStats}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    // Cache actions are surfaced through a menu trigger rather than inline buttons.
    expect(html).toContain('aria-label="Cache actions"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('shows the current root label as a non-interactive label instead of a selector', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={storeScope}
        scopes={[localScope, storeScope]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={cacheStats}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    // The selector now lives in the action rail; ScopeBar surfaces the current
    // root as a plain label alongside runtime/health/cache status.
    expect(html).toContain('Store: team-plans');
    expect(html).not.toContain('<select');
  });

  it('renders cache actions behind a menu trigger without inline details markup', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={storeScope}
        scopes={[localScope, storeScope]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={cacheStats}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Cache 12 KB');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<summary');
    expect(html).not.toContain('Open Folder</button>');
  });

  it('keeps long scope and cache labels narrow-safe', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          ...storeScope,
          id: 'store:very-long-team-plans-for-sidebar-contract',
          label: 'very-long-team-plans-for-sidebar-contract',
          storeId: 'very-long-team-plans-for-sidebar-contract',
        }}
        scopes={[]}
        health={{ status: 'ok', label: 'Healthy' }}
        loading={false}
        cacheStats={{
          ...cacheStats,
          formattedSize: '123456789.0 MB',
          fileCount: 4444,
        }}
        onSelectScope={vi.fn()}
        onCacheAction={vi.fn()}
      />,
    );

    expect(html).toContain('very-long-team-plans-for-sidebar-contract');
    expect(html).toContain('min-w-0');
    expect(html).toContain('truncate');
  });

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

  it('shows the current root label rather than a selector even with multiple scopes', () => {
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

    // Selector moved to the action rail; ScopeBar shows the current root label.
    expect(html).toContain('Local Root');
    expect(html).not.toContain('<select');
  });

  it('explains when store features are available but no stores are registered', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          id: 'local:/workspace',
          label: 'Local Root',
          source: 'local',
          rootPath: '/workspace',
          runtimeSource: 'localSource',
          capabilities: {
            stores: true,
            context: true,
            doctor: true,
            worksets: true,
            diagnostics: [],
          },
        } as any}
        scopes={[
          {
            id: 'local:/workspace',
            label: 'Local Root',
            source: 'local',
            rootPath: '/workspace',
            runtimeSource: 'localSource',
          },
        ]}
        loading={false}
        onSelectScope={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
      />,
    );

    expect(html).toContain('No stores registered');
    expect(html).toContain('openspec store register');
    // The action buttons live in StoresAndWorksetsPanel, not in the ScopeBar hint.
    expect(html).not.toContain('Register Store');
    expect(html).not.toContain('Create Store');
  });

  it('suggests local source mode when store features are unavailable', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          id: 'local:/workspace',
          label: 'Local Root',
          source: 'local',
          rootPath: '/workspace',
          runtimeSource: 'installed',
          capabilities: {
            stores: false,
            context: false,
            doctor: false,
            worksets: false,
            diagnostics: [],
          },
        } as any}
        scopes={[]}
        loading={false}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).toContain('Store-aware features are unavailable');
    expect(html).toContain('Local Source');
  });

  it('returns null when no scope is provided', () => {
    const html = renderToStaticMarkup(
      <ScopeBar scope={undefined} scopes={[]} loading={false} onSelectScope={vi.fn()} />,
    );
    expect(html).toBe('');
  });

  it('does not show a store-unavailable hint when stores are supported but worksets are not', () => {
    // Independent gating: the ScopeBar store hint depends only on the stores
    // capability, not the worksets capability. When stores are supported, the
    // store-unavailable hint MUST NOT render even if worksets are unsupported.
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          ...localScope,
          capabilities: {
            stores: true,
            context: true,
            doctor: true,
            worksets: false,
            diagnostics: [],
          },
        }}
        scopes={[localScope]}
        loading={false}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).not.toContain('Store-aware features are unavailable');
  });

  it('treats omitted capabilities as not gated so the status row stays permissive', () => {
    // Legacy runtime with no capabilities object: the store-unavailable hint
    // MUST NOT render (capabilities are unknown, not explicitly unsupported).
    const html = renderToStaticMarkup(
      <ScopeBar scope={localScope} scopes={[localScope]} loading={false} onSelectScope={vi.fn()} />,
    );

    expect(html).not.toContain('Store-aware features are unavailable');
  });

  it('keeps showing the current root label and health while loading', () => {
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

    // Selector moved to the action rail; ScopeBar surfaces health + label only.
    expect(html).toContain('Local Root');
    expect(html).toContain('Issues');
    expect(html).not.toContain('<select');
  });

  it('shows a scope switching indicator and disables selector while switching', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={localScope}
        scopes={[localScope, storeScope]}
        loading
        loadingReason="scope-switch"
        pendingScopeId={storeScope.id}
        health={{ status: 'ok', label: 'Healthy' }}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/switching|切换/i);
    expect(html).toContain('disabled');
  });

  it('shows cached refresh activity without scope switching copy', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={storeScope}
        scopes={[localScope, storeScope]}
        loading
        loadingReason="background-refresh"
        activity={{ kind: 'cached-refresh', scopeId: storeScope.id }}
        health={{ status: 'ok', label: 'Healthy' }}
        onSelectScope={vi.fn()}
      />,
    );

    expect(html).toMatch(/role=\"status\"/);
    expect(html).toMatch(/cached data|缓存数据/i);
    expect(html).toMatch(/refreshing|刷新/i);
    expect(html).not.toMatch(/switching|切换/i);
  });

  it('shows store setup pending state and disables setup actions', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          ...localScope,
          capabilities: {
            stores: true,
            context: true,
            doctor: true,
            worksets: true,
            diagnostics: [],
          },
        }}
        scopes={[localScope]}
        loading
        loadingReason="store-setup"
        health={{ status: 'ok', label: 'Healthy' }}
        onSelectScope={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
      />,
    );

    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/setting up|创建|配置/i);
    // The Create Store action button lives in StoresAndWorksetsPanel, not ScopeBar.
    expect(html).not.toContain('Create Store');
    expect(html).toContain('disabled');
  });

  it('shows store register pending state and disables register actions', () => {
    const html = renderToStaticMarkup(
      <ScopeBar
        scope={{
          ...localScope,
          capabilities: {
            stores: true,
            context: true,
            doctor: true,
            worksets: true,
            diagnostics: [],
          },
        }}
        scopes={[localScope]}
        loading
        loadingReason="store-register"
        health={{ status: 'ok', label: 'Healthy' }}
        onSelectScope={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
      />,
    );

    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/registering|注册/i);
    // The Register Store action button lives in StoresAndWorksetsPanel, not ScopeBar.
    expect(html).not.toContain('Register Store');
    expect(html).toContain('disabled');
  });

  // NOTE: The optgroup Projects/Stores grouping assertions and the
  // "never surfaces workset names" regression have moved to the dashboard
  // action-rail test, since the root selector now lives in the primary
  // action area (Header) rather than in this CLI/cache status bar.
});
