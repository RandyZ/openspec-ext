import { marked } from 'marked';

// Match MarkdownRenderer / proposal tabs for inline GFM in task lines.
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Render the task line text (after `- [ ]`) as inline HTML for the Tasks tab.
 * Supports **bold**, `code`, links, etc.; not full document features (no mermaid blocks).
 */
export function renderTaskLabelMarkdown(text: string): string {
  const trimmed = text.replace(/\r$/, '').trimEnd();
  if (!trimmed) {
    return '';
  }
  try {
    return marked.parseInline(trimmed, { async: false }) as string;
  } catch {
    return trimmed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
