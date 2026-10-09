# Cursor composer focus after restart

## Symptom

After Cursor restarts, the first workflow launch via `composer.createNew` can leave a **restored previous chat** in the foreground while the new Agent run opens in a background tab.

## Investigation

- Primary launch uses `composer.createNew` with `openInNewTab: true`, `view: 'pane'`, and `unifiedMode: 'agent'`. That creates a new composer, but Cursor may not switch the visible tab to it when session restore replays an older composer.
- Public, stable Cursor commands for “focus composer by id” are not documented in the VS Code API. Runtime detection may expose ids such as `composer.openComposer` or `composer.focusComposer` on some builds; they are not guaranteed across versions.
- A follow-up `workbench.action.chat.open` would prefill/focus chat but can fight with `createNew` and must not await the agent turn.

## Mitigation in the extension

1. After `composer.createNew`, best-effort focus: if `composer.getOrderedSelectedComposerIds` shows a new id, try known focus commands when present (`composer.openComposer`, `composer.focusComposer`, `composer.selectComposer`) with that id — fire-and-forget, no await on the turn.
2. If pane growth is not confirmed within the background check window, show the existing “panel not confirmed” warning.
3. When focus commands are unavailable or ids do not change (restore race), show a one-shot hint that the new run may be in another Agent tab (`agentLaunch.cursorNewTabHint`).

## Reliable fix

No fully reliable, version-stable focus API was found without Cursor-internal hooks. Tab focus behavior should be treated as host-dependent until Cursor documents a supported focus command.
