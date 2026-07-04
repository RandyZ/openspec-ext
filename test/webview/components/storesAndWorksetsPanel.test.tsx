import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StoresAndWorksetsPanel } from '../../../src/webview/components/StoresAndWorksetsPanel';
import type { OpenSpecScopeView } from '../../../src/webview/types/messages';

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

describe('StoresAndWorksetsPanel', () => {
  it('lists registered stores with maintenance actions', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        currentScopeId={localScope.id}
        references={[]}
        worksets={[]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).toContain('Stores &amp; Worksets');
    expect(html).toContain('Store: team-plans');
    expect(html).toContain('/stores/team-plans');
    expect(html).toContain('Open');
    expect(html).toContain('Register Store');
    expect(html).toContain('Create Store');
  });

  it('presents references as read-only context', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope]}
        references={[
          {
            store_id: 'platform-reqs',
            specs: [{ id: 'billing', summary: 'Billing requirements' }],
            fetch: 'openspec show billing --type spec --store platform-reqs',
            status: [],
          },
        ]}
        worksets={[]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).toContain('Read-only references');
    expect(html).toContain('platform-reqs');
    expect(html).toContain('billing');
    expect(html).toContain('Copy fetch command');
    expect(html).not.toContain('Apply');
    expect(html).not.toContain('Archive');
    expect(html).not.toContain('Verify');
  });

  it('navigates to the dedicated Worksets page instead of listing worksets inline', () => {
    const onOpenWorksetsPage = vi.fn();
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope]}
        references={[]}
        worksets={[
          {
            name: 'platform',
            tool: 'code',
            members: [{ name: 'team-plans', path: '/stores/team-plans' }],
          },
        ]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onOpenWorksetsPage={onOpenWorksetsPage}
        onCopyFetch={vi.fn()}
      />,
    );

    // A compact navigation entry opens the dedicated Worksets page.
    expect(html).toContain('Manage Worksets');
    // The inline workset detail (name + tool + members) must NOT render here;
    // it lives on the Worksets page now. The inline row rendered "platform" and
    // "(code)"; neither should appear on the maintenance panel.
    expect(html).not.toContain('platform');
    expect(html).not.toContain('(code)');
    expect(html).not.toContain('Local personal views');
  });

  it('keeps store and reference maintenance actions separate from workset launching', () => {
    const onOpenWorksetsPage = vi.fn();
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        currentScopeId={localScope.id}
        references={[
          {
            store_id: 'platform-reqs',
            specs: [{ id: 'billing', summary: 'Billing requirements' }],
            fetch: 'openspec show billing --type spec --store platform-reqs',
            status: [],
          },
        ]}
        worksets={[]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onOpenWorksetsPage={onOpenWorksetsPage}
        onCopyFetch={vi.fn()}
      />,
    );

    // Store/reference maintenance remains present.
    expect(html).toContain('Store: team-plans');
    expect(html).toContain('platform-reqs');
    expect(html).toContain('Register Store');
    expect(html).toContain('Create Store');
    // Workset launching is a separate navigation affordance.
    expect(html).toContain('Manage Worksets');
  });
});
