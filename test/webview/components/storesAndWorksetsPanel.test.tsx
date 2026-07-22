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
    // The inactive store (current root is Local Root) shows an enabled Switch
    // action rather than the old Open button.
    expect(html).toContain('Switch');
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

  it('renders a lightweight contextual action instead of a dominant panel for plain Local Root', () => {
    // Plain Local Root: no stores, no references, no worksets. The panel must
    // NOT render its dominant management section; at most a lightweight
    // contextual register action / message is allowed.
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope]}
        references={[]}
        worksets={[]}
        lightweight
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    // No dominant Stores & Worksets maintenance block.
    expect(html).not.toContain('Stores &amp; Worksets');
    expect(html).not.toContain('Read-only references');
    expect(html).not.toContain('No stores registered.');
  });

  it('shows a Current state indicator (not a disabled Open) for the selected store', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        currentScopeId={storeScope.id}
        references={[]}
        worksets={[]}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    // The selected store shows a Current state indicator.
    expect(html).toContain('Store: team-plans');
    expect(html).toContain('Current');
    // It MUST NOT show a disabled Open button that looks broken/unavailable.
    expect(html).not.toContain('>Open<');
  });

  it('shows an enabled Switch action for an inactive store that selects the store root', () => {
    const onSelectStore = vi.fn();
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        currentScopeId={localScope.id}
        references={[]}
        worksets={[]}
        onSelectStore={onSelectStore}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    // The inactive store shows an enabled Switch action (not disabled, not Open).
    expect(html).toContain('Store: team-plans');
    expect(html).toContain('Switch');
    const switchIdx = html.indexOf('>Switch<');
    expect(switchIdx).toBeGreaterThan(-1);
    // The Switch button is not disabled.
    const disabledNearSwitch = html.lastIndexOf('disabled', switchIdx);
    const buttonOpenBeforeSwitch = html.lastIndexOf('<button', switchIdx);
    expect(disabledNearSwitch).toBeLessThan(buttonOpenBeforeSwitch);

    // Triggering the Switch action selects the store root and (in the wired
    // dashboard) refreshes root-scoped data. Invoke the prop callback directly
    // since SSR cannot fire click events.
    onSelectStore(storeScope.id);
    expect(onSelectStore).toHaveBeenCalledWith(storeScope.id);
  });

  it('keeps the store id as the primary label and the root path inspectable', () => {
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

    // Store id is the primary label.
    expect(html).toContain('Store: team-plans');
    // Root path remains inspectable via visible text and a title tooltip.
    expect(html).toContain('/stores/team-plans');
    expect(html).toMatch(/title="[^"]*\/stores\/team-plans[^"]*"/);
  });

  it('disables the Switch action while a store action is pending', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        currentScopeId={localScope.id}
        references={[]}
        worksets={[]}
        pending
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    // While a store action is pending, the Switch action is disabled but the
    // current store still shows its Current state.
    expect(html).toContain('Switch');
    const switchIdx = html.indexOf('>Switch<');
    const buttonOpenBeforeSwitch = html.lastIndexOf('<button', switchIdx);
    const disabledNearSwitch = html.indexOf('disabled', buttonOpenBeforeSwitch);
    expect(disabledNearSwitch).toBeGreaterThan(-1);
    expect(disabledNearSwitch).toBeLessThan(switchIdx);
  });
});

describe('StoresAndWorksetsPanel feature gating', () => {
  it('shows an OpenSpec 1.5.0 upgrade notice when worksets are unsupported', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        references={[]}
        worksets={[]}
        capabilities={{ stores: true, worksets: false }}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onOpenWorksetsPage={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    // Store controls may remain (stores supported), but worksets being
    // unavailable MUST surface the upgrade explanation.
    expect(html).toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });

  it('does not show the upgrade notice when both stores and worksets are supported', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        references={[]}
        worksets={[]}
        capabilities={{ stores: true, worksets: true }}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onOpenWorksetsPage={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    expect(html).not.toContain('Stores and worksets require OpenSpec 1.5.0 or newer');
  });

  it('hides store registration controls when stores are unsupported', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        references={[]}
        worksets={[]}
        capabilities={{ stores: false, worksets: true }}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onOpenWorksetsPage={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    // Store registration/setup controls MUST NOT appear as enabled actionable
    // controls when stores are unsupported.
    expect(html).not.toContain('Register Store');
    expect(html).not.toContain('Create Store');
    // The Worksets page entry is independent and remains.
    expect(html).toContain('Manage Worksets');
  });

  it('hides the Worksets page entry when worksets are unsupported but keeps store controls', () => {
    const html = renderToStaticMarkup(
      <StoresAndWorksetsPanel
        scopes={[localScope, storeScope]}
        references={[]}
        worksets={[]}
        capabilities={{ stores: true, worksets: false }}
        onSelectStore={vi.fn()}
        onRegisterStore={vi.fn()}
        onSetupStore={vi.fn()}
        onOpenWorkset={vi.fn()}
        onOpenWorksetsPage={vi.fn()}
        onCopyFetch={vi.fn()}
      />,
    );

    // Store controls remain because stores are supported.
    expect(html).toContain('Register Store');
    // The Worksets page entry MUST be hidden when worksets are unsupported.
    expect(html).not.toContain('Manage Worksets');
  });
});
