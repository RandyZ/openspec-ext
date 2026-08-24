import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../src/i18n';
import { ArtifactViewer } from '../../../src/webview/components/ArtifactViewer';

const missingProps = {
  content: null,
  loading: false,
  error: 'missing',
  errorCode: 'ARTIFACT_MISSING',
  onContinue: () => undefined,
  onExplore: () => undefined,
};

const createProps = {
  ...missingProps,
  onContinue: undefined,
  onCreateWithAi: () => undefined,
};

const outputProps = {
  content: '# Proposal',
  loading: false,
  error: null,
  outputs: [
    { path: 'proposal.md', label: 'proposal.md', kind: 'markdown' as const },
    { path: 'proposal-copy.md', label: 'proposal-copy.md', kind: 'markdown' as const },
  ],
  selectedOutputPath: 'proposal.md',
  onSelectOutput: () => undefined,
};

afterEach(() => setLocale('en'));

describe('ArtifactViewer localized action labels', () => {
  it('renders English action labels and output aria text through i18n', () => {
    setLocale('en');

    const html = renderToStaticMarkup(<ArtifactViewer {...missingProps} />);
    const createHtml = renderToStaticMarkup(<ArtifactViewer {...createProps} />);
    const outputHtml = renderToStaticMarkup(<ArtifactViewer {...outputProps} />);

    expect(html).toContain('>Continue</button>');
    expect(html).toContain('>Explore</button>');
    expect(createHtml).toContain('>Create with AI</button>');
    expect(outputHtml).toContain('aria-label="Artifact output"');
  });

  it('renders Chinese action labels and output aria text through i18n', () => {
    setLocale('zh-cn');

    const html = renderToStaticMarkup(<ArtifactViewer {...missingProps} />);
    const createHtml = renderToStaticMarkup(<ArtifactViewer {...createProps} />);
    const outputHtml = renderToStaticMarkup(<ArtifactViewer {...outputProps} />);

    expect(html).toContain('>继续</button>');
    expect(html).toContain('>探索</button>');
    expect(createHtml).toContain('>用 AI 创建</button>');
    expect(outputHtml).toContain('aria-label="Artifact 输出"');
  });
});
