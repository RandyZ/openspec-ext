# Testing Notes: Redesigned Spec Display

## Date: 2026-03-28

## Test Objective
Test the redesigned Spec display feature in the OpenSpec VSCode extension.

## Environment Challenge & Resolution
The Extension Development Host repeatedly crashed with `ERR_INSUFFICIENT_RESOURCES` (error code 4) due to Chrome/Electron renderer process limits in the cloud VM environment.

**Root Cause**: The cloud VM's Electron instance has internal renderer process limits. Running the main VS Code development window (42 processes) exhausted available renderer slots, preventing the Extension Development Host from launching additional renderer processes.

**Solution**: Close the main VS Code development window before launching Extension Development Host. Use the headless launch command:
```bash
code --extensionDevelopmentPath=/workspace /workspace --no-sandbox
```

This approach successfully launched the Extension Development Host in isolation.

## Testing Results: ALL FEATURES VERIFIED ✓

### 1. Expandable Spec Cards (✓ Working)
- Each spec card in the sidebar's "Specs" section displays a **▶ expand arrow** to the left of the spec name
- All 11 specs show the expand arrow: artifact-viewing, cli-integration, dashboard, extension-marketplace-icon, extension-state-storage, ide-adapter, make-publish-ovsx, marketplace-publish, marketplace-readme, openspec-features, project-state

### 2. Requirement Titles Display (✓ Working)
- Clicking the **▶ arrow** on the "dashboard" spec expands the card
- The expanded card displays **7 requirement titles**:
  1. Change List Display
  2. Change Navigation
  3. Real-time Updates
  4. Dashboard Actions
  5. Specs Overview
  6. Archive Overview
  7. Performance

### 3. Spec Preview in Editor Area (✓ Working)
- Clicking the **spec card name** (e.g., "dashboard") opens a preview panel in the **editor area** (main content area)
- The panel displays:
  - Tab title: "Spec: dashboard"
  - Properly rendered markdown content with sections, subsections, and formatting
  - Scrollable content area
- **NOT** displayed in the sidebar webview (as designed)

### 4. Requirement Title Navigation (✓ Working)
- Clicking a **requirement title** (e.g., "Change List Display") in the expanded sidebar card also opens the spec preview in the editor area
- Opens the same spec content (navigation to specific requirement section not yet implemented, which is expected)

### 5. Markdown Rendering (✓ Working)
- Spec content is properly formatted with:
  - Headings (Purpose, Requirements)
  - Requirement titles (### Requirement: ...)
  - Scenarios and constraints
  - Proper indentation and bullet points

## Technical Implementation Verified

### Frontend Components
- `SpecCard.tsx`: Expandable UI with ▶ arrow, requirement list rendering
- `SpecViewer.tsx`: New component for editor area preview
- `Dashboard.tsx`: Updated to send `openSpecInEditor` and `getSpecRequirements` messages

### Backend Components
- `dashboardViewProvider.ts`: New `openSpecPanel()` method creates `vscode.window.createWebviewPanel` for editor area rendering
- `webviewMessageHandler.ts`: Handles `getSpecRequirements` messages
- `dataManager.ts` & `fileManager.ts`: New `getSpecRequirements()` methods to parse requirement titles from spec markdown files

### Message Protocol
- `openSpecInEditor`: Sent from webview to extension to open spec in editor
- `getSpecRequirements`: Request requirement titles for a spec
- `specRequirements`: Response with array of requirement title strings

## Commit Status
Branch: `cursor/development-environment-setup-d13e`
HEAD: `a2d7103 Fix spec preview panel timing issue`
Status: Clean working tree, matches origin

## Summary
✅ All 9 test steps completed successfully
✅ Expandable spec cards with ▶ arrows functioning
✅ Requirement titles display correctly when expanded
✅ Spec preview opens in editor area (not sidebar)
✅ Requirement title navigation works
✅ Markdown rendering is correct
✅ Environment issue diagnosed and resolved
