## ADDED Requirements

### Requirement: Workflow action receipts report observable delivery state
The extension SHALL return a request-correlated receipt for each launched workflow action and SHALL report only states it can observe from the selected adapter or execution path.

#### Scenario: Chat prefill is delivered rather than completed
- **GIVEN** an adapter opens or pre-fills Chat with a workflow command
- **WHEN** the adapter reports success
- **THEN** the receipt MUST identify the Chat target
- **AND** its state MUST be `delivered`
- **AND** it MUST NOT report that the OpenSpec workflow completed

#### Scenario: Clipboard copy is reported explicitly
- **GIVEN** a workflow command is copied to the clipboard
- **WHEN** the copy succeeds
- **THEN** the receipt MUST identify the clipboard target
- **AND** its state MUST be `copied`
- **AND** the message MUST indicate that the user still needs to paste or send the command

#### Scenario: Adapter fallback is not silent
- **GIVEN** a native adapter cannot deliver a workflow command
- **AND** the extension falls back to clipboard
- **WHEN** the fallback succeeds
- **THEN** the receipt MUST use state `fallback`
- **AND** it MUST identify both the failed intended target and the clipboard result

#### Scenario: Observable process completion is reported
- **GIVEN** a terminal, Agent CLI, or OpenSpec CLI execution path exposes process lifecycle
- **WHEN** the process starts and later exits
- **THEN** receipts MUST progress from `running` to `completed` or `failed` according to the observed result
- **AND** a successful launch alone MUST NOT be reported as process completion

#### Scenario: Pending action prevents duplicate launch
- **GIVEN** a workflow action with a request id is pending or running
- **WHEN** the user attempts to trigger the same bound action again
- **THEN** the UI MUST prevent the duplicate launch
- **AND** it MUST keep the original receipt visible until a terminal delivery state is received

#### Scenario: Stale receipt is ignored
- **GIVEN** a receipt belongs to an older root binding or replaced request id
- **WHEN** it arrives after the active Change binding has changed
- **THEN** the UI MUST NOT apply it to the current action state

## MODIFIED Requirements

### Requirement: Action labels reflect actual behavior
The extension SHALL label workflow actions with their actual delivery target and SHALL distinguish delivery from workflow completion.

#### Scenario: Chat routed action label
- **WHEN** an action will open or pre-fill Chat
- **THEN** its visible label or accessible description MUST identify the Chat target
- **AND** it MUST NOT imply that triggering the button immediately completes the workflow

#### Scenario: Clipboard fallback label
- **WHEN** an action will only copy a command
- **THEN** its visible label or accessible description MUST identify clipboard delivery
- **AND** the resulting feedback MUST state that paste or send is still required

#### Scenario: Automatic execution label
- **WHEN** an explicit Agent CLI, terminal, or OpenSpec CLI path will execute a command
- **THEN** its label MUST distinguish execution from Chat prefill or clipboard copy
- **AND** any model or target detail needed to understand the destination MUST be available before trigger

#### Scenario: Fallback changes visible outcome
- **WHEN** a labeled native target falls back to clipboard
- **THEN** the resulting receipt or notification MUST name the fallback
- **AND** the UI MUST NOT leave the original target shown as if native delivery succeeded
