## ADDED Requirements

### Requirement: Project-first Sidebar presents bounded recommended actions
The Project-first Sidebar SHALL present a compact, bounded action rail that explains why each Change is shown and what the available CTA will do.

#### Scenario: Recommended action rail is bounded and prioritized
- **GIVEN** multiple Changes qualify for Needs Attention, Ready to Verify, or Recommended
- **WHEN** the Project-first Sidebar renders the action rail
- **THEN** it MUST order candidates by Needs Attention, then Ready to Verify, then Recommended
- **AND** it MUST render no more than three action rows in total

#### Scenario: Each action row explains its action
- **GIVEN** a Change is included in the action rail
- **WHEN** its row renders
- **THEN** the row MUST show a status or reason label, the bounded Change name, and an explicit CTA label
- **AND** the row MUST use a theme-aware border, background, icon or text indicator, hover state, and visible keyboard focus state
- **AND** the meaning MUST NOT depend on color alone

#### Scenario: Needs Attention opens a safe review surface
- **GIVEN** a binding-matching Change has resolver attention or a failed or fallback action receipt
- **WHEN** the user activates its Review CTA
- **THEN** the extension MUST open the binding-aware Change Detail
- **AND** it MUST NOT retry or directly execute the failed workflow action

#### Scenario: Ready to Verify uses the interactive route
- **GIVEN** a Change has a resolved Verify recommendation
- **WHEN** the user activates its Verify CTA
- **THEN** the extension MUST use the existing interactive Verify and Archive route
- **AND** it MUST NOT use headless `agentCli` or direct archive

#### Scenario: Recommended CTA uses shared resolution
- **GIVEN** an active Change has a non-high-impact recommended action
- **WHEN** its recommended action row renders and the user activates its CTA
- **THEN** the CTA label and action MUST come from the latest binding-matching `resolveWorkflowActions()` result
- **AND** execution MUST use the existing workflow launch settings and handler

#### Scenario: High-impact recommendations preserve the safety boundary
- **GIVEN** the shared resolver returns a complex or high-impact action
- **WHEN** the action is represented in the Sidebar rail
- **THEN** activation MUST open or reveal the bound Change Detail safety surface
- **AND** the Sidebar MUST NOT expose direct Archive Now execution

#### Scenario: Stale or cross-binding receipts do not affect recommendations
- **GIVEN** a failed or fallback receipt belongs to another binding or an older request
- **WHEN** priorities are resolved
- **THEN** that receipt MUST NOT move the current binding's Change into Needs Attention
- **AND** the current binding's action rail MUST continue to use its accepted snapshot and receipts

