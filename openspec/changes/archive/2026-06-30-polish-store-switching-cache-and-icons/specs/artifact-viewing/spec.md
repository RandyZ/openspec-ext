## ADDED Requirements

### Requirement: Stable webview action icons
Change detail and artifact action controls SHALL render stable, accessible icons in VS Code and Cursor webviews.

Critical action icons MUST NOT depend on a webfont that can fail to load inside the webview. Each icon-only action MUST retain an accessible label and tooltip.

#### Scenario: Copy change name icon renders
- **GIVEN** the user opens a change detail view
- **WHEN** the copy change name action is visible beside the change title
- **THEN** the action MUST render a visible copy icon
- **AND** the icon MUST NOT appear as an empty square or missing glyph
- **AND** the action MUST expose an accessible label for copying the change name

#### Scenario: Copy change name success state renders
- **GIVEN** the user clicks the copy change name action
- **WHEN** the copy operation succeeds
- **THEN** the action MUST render a visible success icon or equivalent visual confirmation
- **AND** the action MUST update its accessible label to indicate that the change name was copied

#### Scenario: Icons render without codicon font
- **GIVEN** the codicon webfont is unavailable or blocked by webview resource loading
- **WHEN** change detail action buttons render
- **THEN** critical action icons MUST remain visible
- **AND** action buttons MUST remain keyboard focusable and screen-reader addressable
