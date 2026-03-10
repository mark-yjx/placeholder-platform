import { describe, expect, it } from 'vitest';
import {
  buildProblemStatementMarkdown,
  splitProblemStatementMarkdown
} from '../problemStatementSections';

describe('problemStatementSections', () => {
  it('splits input and output sections away from the main statement body', () => {
    const sections = splitProblemStatementMarkdown(
      '# Collapse\n\nBase description.\n\n## Input\n\nAn integer.\n\n## Output\n\nA collapsed integer.\n\n## Examples\n\nKeep this section.'
    );

    expect(sections).toEqual({
      bodyMarkdown: '# Collapse\n\nBase description.\n\n## Examples\n\nKeep this section.',
      inputFormatMarkdown: 'An integer.',
      outputFormatMarkdown: 'A collapsed integer.'
    });
  });

  it('rebuilds the statement markdown with normalized input and output sections', () => {
    expect(
      buildProblemStatementMarkdown({
        bodyMarkdown: '# Collapse\n\nBase description.',
        inputFormatMarkdown: 'An integer.',
        outputFormatMarkdown: 'A collapsed integer.'
      })
    ).toBe(
      '# Collapse\n\nBase description.\n\n## Input\n\nAn integer.\n\n## Output\n\nA collapsed integer.'
    );
  });
});
