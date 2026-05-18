import { describe, it, expect } from 'vitest';
import { renderTaskLabelMarkdown } from '../../../src/webview/utils/taskLabelMarkdown';

describe('renderTaskLabelMarkdown', () => {
  it('renders bold and inline code without raw delimiters', () => {
    const html = renderTaskLabelMarkdown(
      '0.1 **盘点**: 梳理 `GDQSwiftCalcGspTableView` / `CalcExprEdit`'
    );
    expect(html).toContain('<strong>盘点</strong>');
    expect(html).toContain('<code>GDQSwiftCalcGspTableView</code>');
    expect(html).not.toContain('**');
    expect(html).not.toContain('`GDQSwiftCalcGspTableView`');
  });

  it('strips trailing CR from CRLF segments', () => {
    const html = renderTaskLabelMarkdown('**x**\r');
    expect(html).toContain('<strong>x</strong>');
    expect(html).not.toContain('\r');
  });
});
