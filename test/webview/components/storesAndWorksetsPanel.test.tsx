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

  it('lists worksets as local personal views', () => {
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
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).toContain('Personal worksets');
    expect(html).toContain('Local personal views');
    expect(html).toContain('platform');
    expect(html).toContain('code');
  });
});
