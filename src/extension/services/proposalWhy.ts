const SUMMARY_LIMIT = 150;

export interface ProposalWhyText {
  summary: string;
  fullText: string;
}

function normalizeMarkdownText(markdown: string): string {
  return markdown
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractProposalWhy(markdown: string): ProposalWhyText {
  const match = markdown.match(/^##\s+Why\s*\n(?<body>[\s\S]*?)(?=^##\s+|\s*$)/im);
  const fullText = normalizeMarkdownText(match?.groups?.body ?? '');
  const summary =
    fullText.length > SUMMARY_LIMIT
      ? `${fullText.slice(0, SUMMARY_LIMIT)}...`
      : fullText;

  return { summary, fullText };
}
