type SupportedSection = 'input' | 'output';

export type ProblemStatementSections = {
  bodyMarkdown: string;
  inputFormatMarkdown: string;
  outputFormatMarkdown: string;
};

type HeadingMatch = {
  start: number;
  end: number;
  level: number;
  normalizedLabel: string;
};

const SUPPORTED_SECTIONS = new Set<SupportedSection>(['input', 'output']);

function normalizeHeadingLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function collectHeadings(markdown: string): HeadingMatch[] {
  const matches: HeadingMatch[] = [];
  const headingPattern = /^(#{1,6})\s+(.*)$/gm;

  for (const match of markdown.matchAll(headingPattern)) {
    const [, hashes = '', label = ''] = match;
    matches.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      level: hashes.length,
      normalizedLabel: normalizeHeadingLabel(label)
    });
  }

  return matches;
}

function sectionRange(
  headings: readonly HeadingMatch[],
  target: SupportedSection
): { start: number; end: number } | null {
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (heading.normalizedLabel !== target) {
      continue;
    }

    return {
      start: heading.start,
      end: headings[index + 1]?.start ?? Number.MAX_SAFE_INTEGER
    };
  }

  return null;
}

function extractSectionContent(markdown: string, target: SupportedSection): string {
  const headings = collectHeadings(markdown);
  const range = sectionRange(headings, target);
  if (!range) {
    return '';
  }

  const boundedEnd = Math.min(range.end, markdown.length);
  const heading = headings.find((item) => item.start === range.start);
  if (!heading) {
    return '';
  }

  return markdown.slice(heading.end, boundedEnd).trim();
}

function removeSupportedSections(markdown: string): string {
  const headings = collectHeadings(markdown);
  if (headings.length === 0) {
    return markdown.trimEnd();
  }

  let cursor = 0;
  let result = '';

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!SUPPORTED_SECTIONS.has(heading.normalizedLabel as SupportedSection)) {
      continue;
    }

    const sectionEnd = headings[index + 1]?.start ?? markdown.length;
    result += markdown.slice(cursor, heading.start);
    cursor = sectionEnd;
  }

  result += markdown.slice(cursor);
  return result.trimEnd();
}

function buildSection(label: 'Input' | 'Output', content: string): string {
  return `## ${label}\n\n${content.trim()}`;
}

export function splitProblemStatementMarkdown(markdown: string): ProblemStatementSections {
  return {
    bodyMarkdown: removeSupportedSections(markdown),
    inputFormatMarkdown: extractSectionContent(markdown, 'input'),
    outputFormatMarkdown: extractSectionContent(markdown, 'output')
  };
}

export function buildProblemStatementMarkdown(
  sections: ProblemStatementSections
): string {
  const bodyMarkdown = sections.bodyMarkdown.trim();
  const inputFormatMarkdown = sections.inputFormatMarkdown.trim();
  const outputFormatMarkdown = sections.outputFormatMarkdown.trim();
  const parts: string[] = [];

  if (bodyMarkdown) {
    parts.push(bodyMarkdown);
  }
  if (inputFormatMarkdown) {
    parts.push(buildSection('Input', inputFormatMarkdown));
  }
  if (outputFormatMarkdown) {
    parts.push(buildSection('Output', outputFormatMarkdown));
  }

  return parts.join('\n\n').trimEnd();
}
