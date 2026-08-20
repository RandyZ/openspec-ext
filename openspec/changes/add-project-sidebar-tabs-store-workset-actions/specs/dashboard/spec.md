## MODIFIED Requirements

### Requirement: Existing cache avoids click-time reload
- **GIVEN** Project-first Sidebar data has already been loaded for a Project binding
- **WHEN** the user reveals the OpenSpec Sidebar, switches between Changes and Specs tabs, or opens a Change/Spec detail
- **THEN** the UI MUST reuse cached data where the Project and binding identity still match
- **AND** tab switching MUST NOT create a new list Explorer panel
- **AND** tab switching MUST NOT trigger an additional full OpenSpec scan solely because of the click

#### Scenario: Sidebar warm cache
- **GIVEN** a valid cached Project workspace payload exists
- **WHEN** the OpenSpec Sidebar becomes visible
- **THEN** the cached Changes and Specs tabs MUST render immediately
- **AND** a later fresh payload MUST replace them only after its binding identity is verified

#### Scenario: Tab switch is local
- **GIVEN** the current Project workspace payload contains Changes and Specs
- **WHEN** the user switches from Changes to Specs or back
- **THEN** the Webview MUST change the active tab locally
- **AND** the Extension Host MUST NOT create an Editor Explorer panel or repeat root resolution

#### Scenario: Cache is binding-scoped
- **GIVEN** two Projects or Store bindings contain same-named Changes or Specs
- **WHEN** the user switches Project or Store context
- **THEN** only data whose cache key matches the selected binding MAY be displayed
- **AND** stale data from the previous binding MUST NOT leak into the selected tab
