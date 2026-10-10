# Cursor composer focus after restart

## Symptom

After Cursor restarts, the first workflow launch via `composer.createNew` can leave a **restored previous chat** visible while the new Agent run opens in another tab.

## Investigation (2026-10-09 QA)

- Post–PR #25 `tryFocusComposerById` called `composer.openComposer` with `{ composerId }` ~100ms after `composer.createNew`. On Cursor 3.21.16 this **regressed** launch: tabs collapsed, blank “Loading Chat”, prefill lost, and errors such as `e.path.replace is not a function` inside `computeTabLabels` → `openEditor`. The object form was treated as an editor input.
- **Decision:** remove all post–`createNew` composer focus / `openComposer` calls. Launch behavior matches pre-focus builds (e.g. 0.2.4-agent-panel.18 / `bdeab81`).
- There is still no stable, public Cursor API to focus a composer by id without risking editor corruption.

## Mitigation in the extension

1. **Launch:** only `composer.createNew` (or chat/deeplink fallbacks) — no follow-up focus commands.
2. **First launch per activation:** one non-modal toast (`agentLaunch.cursorFirstPanelTabHint`) on the first successful Cursor agent-panel launch after the extension activates in that window.
3. **Background pane check:** unchanged warning if pane count does not increase within 1.5s (`agentLaunch.panelNotConfirmed`).

## Reliable fix

None without Cursor-supported focus API. Track Cursor releases for a documented “focus composer” command that accepts an id safely.
