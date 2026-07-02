# Task 5. Stable Action Icons

<!-- covers: Task 5.1, Task 5.2, Task 5.3 -->

### Task 5.1: Add failing IconButton tests for SVG icons without codicon classes

**Spec coverage:** `artifact-viewing` / `### Requirement: Stable webview action icons` / `#### Scenario: Icons render without codicon font`

**Files:**
- Create: none
- Modify: `test/webview/components/iconButton.test.tsx`
- Test: `test/webview/components/iconButton.test.tsx`

- [ ] **Step 1: Replace the existing codicon expectation**

Modify `test/webview/components/iconButton.test.tsx`:

```tsx
describe('IconButton', () => {
  it('renders an accessible SVG button without codicon font classes', () => {
    render(<IconButton icon="copy" label="Copy change name" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Copy change name' });
    expect(button).toBeInTheDocument();
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.querySelector('.codicon')).toBeNull();
  });

  it('renders a visible success icon', () => {
    render(<IconButton icon="check" label="Copied" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Copied' }).querySelector('svg')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test - expect FAIL**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/webview/components/iconButton.test.tsx"
```

Expected: FAIL because `IconButton` still renders codicon spans.

---

### Task 5.2: Replace IconButton codicon rendering with typed bundled SVG icons

**Spec coverage:** `artifact-viewing` / `### Requirement: Stable webview action icons` / all scenarios

**Files:**
- Create: none
- Modify: `src/webview/components/ui/IconButton.tsx`
- Test: `test/webview/components/iconButton.test.tsx`

- [ ] **Step 1: Implement typed icon names**

Modify `src/webview/components/ui/IconButton.tsx`:

```tsx
import React from 'react';
import { Tooltip } from './Tooltip';

export type IconName = 'copy' | 'check' | 'refresh' | 'go-to-file';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
}

function IconGlyph({ icon }: { icon: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (icon === 'check') {
    return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  }
  if (icon === 'refresh') {
    return <svg {...common}><path d="M21 12a9 9 0 0 1-15.5 6.3" /><path d="M3 12A9 9 0 0 1 18.5 5.7" /><path d="M3 3v6h6" /><path d="M21 21v-6h-6" /></svg>;
  }
  if (icon === 'go-to-file') {
    return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6" /></svg>;
  }
  return <svg {...common}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  className = '',
  ...props
}) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded border border-transparent bg-transparent text-[var(--vscode-foreground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] ${className}`}
      {...props}
    >
      <IconGlyph icon={icon} />
    </button>
  </Tooltip>
);
```

- [ ] **Step 2: Fix type errors at call sites**

Update any `IconButton icon="..."` usage to one of the typed names. If a call site uses a different icon name, add a real SVG branch and include a matching test.

- [ ] **Step 3: Run test - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/webview/components/iconButton.test.tsx"
```

Expected: PASS.

---

### Task 5.3: Verify ChangeDetail copy icon success state and accessibility

**Spec coverage:** `artifact-viewing` / `### Requirement: Stable webview action icons` / copy icon scenarios

**Files:**
- Create: none
- Modify: `test/webview/components/changeDetailRouting.test.ts`, `src/webview/components/ChangeDetail.tsx`
- Test: `test/webview/components/changeDetailRouting.test.ts`, `test/webview/components/iconButton.test.tsx`

- [ ] **Step 1: Add ChangeDetail copy-state test**

In `test/webview/components/changeDetailRouting.test.ts`, extend the existing copy change name test:

```ts
it('renders copy change name with stable accessible icon states', () => {
  const source = readFileSync('src/webview/components/ChangeDetail.tsx', 'utf8');

  expect(source).toContain('icon={copiedName ? \\'check\\' : \\'copy\\'}');
  expect(source).toContain("t('action.copyChangeName')");
  expect(source).toContain("t('action.copiedChangeName')");
});
```

- [ ] **Step 2: Confirm ChangeDetail still uses typed names**

In `src/webview/components/ChangeDetail.tsx`, keep:

```tsx
<IconButton
  icon={copiedName ? 'check' : 'copy'}
  label={copiedName ? t('action.copiedChangeName') : t('action.copyChangeName')}
  onClick={handleCopyChangeName}
/>
```

- [ ] **Step 3: Run tests - expect PASS**

Run:

```bash
zsh -c "source ~/.zshrc && rtk pnpm test -- test/webview/components/iconButton.test.tsx test/webview/components/changeDetailRouting.test.ts"
```

Expected: PASS.
