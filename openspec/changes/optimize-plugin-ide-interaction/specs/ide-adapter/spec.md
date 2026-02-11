# IDE Adapter Specification

## Purpose

Define the Agent executor adapter interface and discovery mechanism so the extension can integrate with multiple IDE/Agent environments (Cursor, Claude Code, VSCode AI, etc.) in an isolated, user-selectable way.

## ADDED Requirements

### Requirement: Adapter interface
The system SHALL define a single adapter interface that all Agent executors implement.

#### Scenario: Interface contract
- WHEN an adapter is implemented
- THEN it MUST expose: unique id, displayName, isAvailable(), executeTask(request), fillChat(request)
- AND the main application logic MUST depend only on this interface, not on concrete adapter implementations

#### Scenario: Request and result types
- WHEN the main logic invokes an adapter
- THEN it MUST pass a request containing: changeName, taskIndex, taskText, contextFiles, workspaceRoot
- AND the adapter MUST return a result containing: success, optional message, adapterId

### Requirement: Adapter discovery
The system SHALL discover which adapters are available in the current environment.

#### Scenario: Availability check at activation
- GIVEN the extension has registered one or more adapters
- WHEN the extension activates or the OpenSpec view is opened
- THEN each adapter's isAvailable() MUST be invoked
- AND the list of adapters for which isAvailable() resolves to true MUST be treated as the available set

#### Scenario: No adapters available
- GIVEN all registered adapters return false from isAvailable()
- WHEN the user attempts to use task execution or fillChat
- THEN the system MUST show a clear message that no executor is available
- AND MUST suggest installing or configuring at least one supported environment (e.g. Cursor, Claude Code) or using the clipboard adapter

### Requirement: User selection of adapter
The system SHALL allow the user to choose which adapter to use when multiple are available.

#### Scenario: Persisted selection
- GIVEN a configuration key for the preferred adapter (e.g. openspec.preferredAgentAdapter)
- WHEN the user selects an adapter (e.g. in settings or in a picker)
- THEN the selected adapter id MUST be persisted
- AND subsequent execute or fillChat actions MUST use that adapter when it is available

#### Scenario: Selection when preferred is unavailable
- GIVEN the user had previously selected an adapter that is no longer available
- WHEN the user triggers execute or fillChat
- THEN the system MUST fall back to another available adapter (e.g. first in list) or prompt the user to choose again
- AND MUST NOT assume a fixed priority order for auto-selection when the user has not chosen

#### Scenario: User can see and change selection
- GIVEN at least one adapter is available
- WHEN the user opens the relevant settings or execution entry point
- THEN the list of available adapters MUST be shown
- AND the current selection MUST be indicated
- AND the user MUST be able to switch the selected adapter

### Requirement: Execute task via adapter
The system SHALL support executing a task through the selected adapter (auto mode).

#### Scenario: Invoke executeTask
- GIVEN taskExecutionMode is "auto" and a valid adapter is selected
- WHEN the user triggers execution for a task (after dependency check passes)
- THEN the system MUST call the selected adapter's executeTask(request)
- AND MUST pass the correct changeName, taskIndex, taskText, contextFiles, and workspaceRoot
- AND MUST surface success or failure and any message to the user

### Requirement: Fill chat via adapter
The system SHALL support filling Chat (or clipboard) through the selected adapter (fillChat mode).

#### Scenario: Invoke fillChat
- GIVEN taskExecutionMode is "fillChat" and a valid adapter is selected
- WHEN the user triggers fillChat for a task (after dependency check passes)
- THEN the system MUST call the selected adapter's fillChat(request)
- AND MUST treat either "open Chat and prefill" or "copy to clipboard and notify" as successful fillChat
- AND MUST NOT require the main logic to distinguish between prefill and clipboard fallback

#### Scenario: Clipboard fallback
- GIVEN an adapter cannot prefill the Chat input (e.g. no API available)
- WHEN that adapter's fillChat is called
- THEN the adapter MUST copy the generated prompt or command to the clipboard
- AND MUST inform the user (e.g. message "已复制到剪贴板，可粘贴到 Chat")
- AND MUST return success so the main logic does not treat it as an error

### Requirement: Adapter registration and extension
The system SHALL host adapters in an isolated directory and allow new adapters to be added without changing main logic.

#### Scenario: Adapters in dedicated directory
- WHEN the codebase is organized
- THEN adapter implementations MUST live in a dedicated directory (e.g. src/extension/adapters/)
- AND a single loader or index MUST register all adapters and perform discovery
- AND the main logic MUST obtain the current adapter only through this loader, not by importing concrete adapter modules

#### Scenario: Adding a new adapter
- GIVEN a new adapter implementation that conforms to the adapter interface
- WHEN the adapter is registered in the loader (e.g. in adapters/index.ts)
- THEN it MUST appear in the available list when isAvailable() is true
- AND the user MUST be able to select it without any change to the main task execution or fillChat flow

## Dependencies

- Configuration API for preferredAgentAdapter and taskExecutionMode
- Access to workspace root and openspec change paths
- VSCode clipboard API for clipboard fallback
- Optional: external CLI (agent, claude) or VSCode Chat API depending on adapter
