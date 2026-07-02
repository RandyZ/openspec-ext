## ADDED Requirements

### Requirement: Stable cache status rail controls
The extension SHALL expose cache status and cache actions without changing the status rail layout when actions are opened.

The cache summary MUST remain a compact status rail item. Cache operations MUST be presented in a menu, popover, or equivalent overlay that does not reflow the surrounding status rail content.

#### Scenario: Cache actions open without rail reflow
- **GIVEN** the dashboard status rail shows the cache summary
- **WHEN** the user opens cache actions
- **THEN** the cache summary row MUST keep its position and height
- **AND** cache action controls MUST appear in a menu, popover, or equivalent overlay
- **AND** the dashboard MUST NOT insert an inline action row that changes the rail's vertical layout

#### Scenario: Cache actions remain accessible
- **GIVEN** cache actions are available in the status rail
- **WHEN** the user navigates with keyboard or assistive technology
- **THEN** the cache actions trigger MUST be focusable
- **AND** each cache action MUST be reachable and activatable
- **AND** opening or closing the action surface MUST preserve a predictable focus target

#### Scenario: Cache action state is visible
- **GIVEN** a cache action is running
- **WHEN** the cache action surface is open
- **THEN** the running action MUST show pending state
- **AND** duplicate destructive cache actions MUST be disabled until the operation completes

### Requirement: Cache statistics refresh semantics
The extension SHALL treat displayed cache statistics as extension cache root statistics unless per-root cache statistics are explicitly implemented.

Changing the selected OpenSpec root MUST NOT force a full cache statistics recalculation. Forced recalculation MUST be reserved for explicit user refreshes, cache mutations, or cache stat dirty states.

#### Scenario: Root switch does not force cache stats recalculation
- **GIVEN** the dashboard has a current cache statistics snapshot
- **WHEN** the user switches the selected OpenSpec root
- **THEN** the dashboard MUST keep or reuse the current cache statistics snapshot
- **AND** the dashboard MUST NOT request a forced cache statistics recalculation solely because the root changed
- **AND** the cache summary copy MUST NOT imply that the statistic belongs only to the selected root

#### Scenario: Explicit cache refresh can recalculate statistics
- **GIVEN** the user explicitly requests a cache refresh or opens cache details
- **WHEN** the extension host receives the cache statistics request
- **THEN** the extension MUST recompute cache statistics when the request asks for a forced refresh or the existing snapshot is stale
- **AND** the recomputed statistics MUST describe the same cache scope shown in the status rail

#### Scenario: Cache mutation refreshes statistics
- **GIVEN** the user clears cache data or performs another cache action that changes stored cache files
- **WHEN** the cache action succeeds
- **THEN** the extension MUST mark cache statistics dirty or recompute them
- **AND** the next displayed cache summary MUST reflect the mutation result
