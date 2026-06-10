import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '../../../src/webview/components/ui/IconButton';

describe('IconButton', () => {
  it('renders an accessible codicon button', () => {
    const html = renderToStaticMarkup(
      <IconButton icon="copy" label="Copy change name" onClick={vi.fn()} />
    );

    expect(html).toContain('aria-label="Copy change name"');
    expect(html).toContain('codicon');
    expect(html).toContain('codicon-copy');
  });
});
