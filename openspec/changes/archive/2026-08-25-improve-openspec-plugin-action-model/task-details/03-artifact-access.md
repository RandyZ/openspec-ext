# Task 3. Root-bound dynamic artifact access

<!-- covers: Task 3.1, Task 3.2, Task 3.3 -->

### Task 3.1: Implement host-authoritative artifact output membership and containment with TDD

**Spec coverage:** `artifact-viewing` / `Status-owned artifact paths` / all scenarios; `Error Handling` / `Artifact read error`

**Dependencies / order:** Requires Task 1 bound snapshot; complete before dynamic Detail UI.

**Files:**
- Modify: `src/extension/services/projectDataGateway.ts`, `src/extension/providers/webviewMessageHandler.ts`, `src/webview/types/messages.ts`
- Test: `test/extension/services/projectDataGateway.test.ts`, `test/extension/providers/webviewMessageHandler.test.ts`

**Implementation notes:** Treat Webview path as a selection hint only. Re-resolve the bound snapshot, require exact membership in existingOutputPaths, canonicalize, and require containment before read/open.

**Verification:** Focused tests must pass valid local/Store paths and reject traversal, sibling-root, stale, and unlisted outputs with zero reads.

**Risks / edge cases:** Symlinks, removed files between status and read, Store roots outside workspace, and encoded path variants.

- [ ] **Step 1:** Add failing trust-boundary tests with spy readers and malicious/unlisted paths.
- [ ] **Step 2:** Run focused tests and confirm RED on current guessed path behavior.
- [ ] **Step 3:** Add the minimal host-side member and containment resolver, then route read/open through it.
- [ ] **Step 4:** Re-run and confirm PASS with fail-closed errors and no unauthorized read.

---

### Task 3.2: Support multiple outputs with generic, Specs, and Tasks rendering metadata with TDD

**Spec coverage:** `artifact-viewing` / `Schema-agnostic artifact content rendering` / all scenarios; `Artifact Navigation` / `Navigate among multiple outputs`, `Artifact quick links`; `Error Handling` / `Large artifact files`

**Dependencies / order:** Requires Task 3.1 safe output resolution.

**Files:**
- Modify: `src/webview/types/messages.ts`, `src/extension/providers/webviewMessageHandler.ts`, `src/webview/components/ArtifactViewer.tsx`, `src/webview/components/ChangeDetail.tsx`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`, `test/webview/components/changeDetailRouting.test.ts`

**Implementation notes:** Return output descriptors separately from content. Select existing specialized renderers by artifact semantics; use current Markdown viewer otherwise. Multiple files use a simple accessible list, not a new tree component.

**Verification:** Focused tests must cover one Markdown output, two outputs, Specs/Tasks specialization, safe quick links, and large-file warning.

**Risks / edge cases:** Empty outputs, duplicate basenames, non-Markdown files, and output disappearance after selection.

- [ ] **Step 1:** Add failing message/render tests for single, multi-output, specialized, and large-file cases.
- [ ] **Step 2:** Run focused tests and confirm RED on fixed artifactType payloads.
- [ ] **Step 3:** Extend existing messages and viewer selection with the minimum output descriptor fields.
- [ ] **Step 4:** Re-run and confirm PASS without adding a file-tree dependency.

---

### Task 3.3: Preserve safe read-only archived artifact behavior without guessed active paths with TDD

**Spec coverage:** `workflow-control` / `Shared workflow action resolution` / `Archived Change remains read-only history`; `artifact-viewing` / `Status-owned artifact paths` / `Unknown artifact path is not guessed`

**Dependencies / order:** Requires active-path separation from Tasks 3.1–3.2.

**Files:**
- Modify: `src/extension/services/fileManager.ts`, `src/extension/providers/webviewMessageHandler.ts`, `src/webview/components/ChangeDetail.tsx`
- Test: `test/extension/providers/webviewMessageHandler.test.ts`, `test/webview/components/changeDetailRouting.test.ts`

**Implementation notes:** Keep existing archived conventional reads as an explicit read-only compatibility branch. Never reuse its filename fallback for active custom artifacts and never mark missing archived steps done.

**Verification:** Focused tests must show archived known files remain readable, all archived writes stay disabled, and an active unknown id is never guessed.

**Risks / edge cases:** Historical archive layouts, archive names with date prefixes, and missing legacy files.

- [ ] **Step 1:** Add failing paired tests for archived known files and active unknown artifact ids.
- [ ] **Step 2:** Run focused tests and confirm the active unknown path currently reaches the fallback.
- [ ] **Step 3:** Isolate the legacy read-only branch and remove fallback use from active requests.
- [ ] **Step 4:** Re-run and confirm archived compatibility plus active fail-closed behavior.
