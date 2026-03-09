#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const roots = [];
  let write = true;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --root');
      }
      roots.push(next);
      index += 1;
      continue;
    }
    if (value === '--dry-run') {
      write = false;
      continue;
    }
    throw new Error(`Unsupported argument: ${value}`);
  }

  return {
    roots: roots.length > 0 ? roots : ['problems', 'data/problems'],
    write
  };
}

export function findProblemDirectories(roots) {
  return roots
    .flatMap((rootDir) => {
      if (!fs.existsSync(rootDir)) {
        return [];
      }

      return fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootDir, entry.name));
    })
    .sort((left, right) => left.localeCompare(right));
}

function tryParseJsonLiteral(raw) {
  const trimmed = raw.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  if (trimmed === 'True') {
    return true;
  }
  if (trimmed === 'False') {
    return false;
  }
  if (trimmed === 'None') {
    return null;
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    trimmed === 'null' ||
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('{')
  ) {
    return JSON.parse(trimmed);
  }

  throw new Error(`Unsupported doctest literal: ${trimmed}`);
}

function deriveEntryFunction(starterSource) {
  const match = starterSource.match(/^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/m);
  return match ? match[1] : null;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return loadJson(filePath);
}

function countLeadingSpaces(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function removeEmptyDocstringBlocks(lines) {
  const cleaned = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed !== '"""' && trimmed !== "'''") {
      cleaned.push(lines[index]);
      continue;
    }

    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor].trim() === '') {
      cursor += 1;
    }

    if (cursor < lines.length && lines[cursor].trim() === trimmed) {
      index = cursor;
      continue;
    }

    cleaned.push(lines[index]);
  }

  return cleaned;
}

function extractDoctestCases(starterSource, entryFunction) {
  const lines = starterSource.split('\n');
  const removedLineIndexes = new Set();
  const cases = [];
  const manualReview = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const promptMatch = line.match(/^(\s*)>>>\s*(.+)$/);
    if (!promptMatch) {
      continue;
    }

    const callText = promptMatch[2].trim();
    if (callText.includes('...')) {
      manualReview.push(`Line ${index + 1}: continuation prompts are not migrated automatically`);
      continue;
    }

    const callMatch = callText.match(new RegExp(`^${entryFunction}\\((.*)\\)$`));
    if (!callMatch) {
      manualReview.push(`Line ${index + 1}: doctest call does not match entryFunction ${entryFunction}()`);
      continue;
    }

    const inputLiteral = callMatch[1].trim();
    const outputLines = [];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const candidate = lines[cursor];
      if (/^\s*>>>/.test(candidate)) {
        break;
      }
      if (candidate.trim() === '"""' || candidate.trim() === "'''") {
        break;
      }
      if (candidate.trim() === '' && outputLines.length === 0) {
        cursor += 1;
        continue;
      }
      if (candidate.trim() === '' && outputLines.length > 0) {
        break;
      }
      if (countLeadingSpaces(candidate) < countLeadingSpaces(line)) {
        break;
      }
      outputLines.push(candidate.trim());
      cursor += 1;
    }

    if (outputLines.length !== 1) {
      manualReview.push(`Line ${index + 1}: expected exactly one output line`);
      continue;
    }

    try {
      cases.push({
        input: tryParseJsonLiteral(inputLiteral),
        output: tryParseJsonLiteral(outputLines[0])
      });
      removedLineIndexes.add(index);
      for (let removeIndex = index + 1; removeIndex < cursor; removeIndex += 1) {
        removedLineIndexes.add(removeIndex);
      }
      index = cursor - 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      manualReview.push(`Line ${index + 1}: ${message}`);
    }
  }

  const cleanedStarter = removeEmptyDocstringBlocks(
    lines.filter((_, index) => !removedLineIndexes.has(index))
  ).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

  return {
    doctestFound: cases.length > 0 || manualReview.length > 0 || /^\s*>>>/m.test(starterSource),
    cases,
    cleanedStarter,
    manualReview
  };
}

function mergeManifestPublicTests(manifest, extractedCases) {
  const current = Array.isArray(manifest.publicTests) ? manifest.publicTests : [];
  if (current.length === 0) {
    return {
      manifest: {
        ...manifest,
        publicTests: extractedCases
      },
      updated: true,
      manualReview: []
    };
  }

  if (JSON.stringify(current) === JSON.stringify(extractedCases)) {
    return {
      manifest,
      updated: false,
      manualReview: []
    };
  }

  return {
    manifest,
    updated: false,
    manualReview: ['Existing manifest publicTests differ from extracted doctest cases']
  };
}

function fillManifestDefaults(manifest, fallbackMetadata, starterSource, problemDir) {
  const derived = { ...manifest };
  const problemId = path.basename(problemDir);
  const starterEntryFunction = deriveEntryFunction(starterSource);

  if (!derived.problemId && typeof fallbackMetadata?.slug === 'string') {
    derived.problemId = fallbackMetadata.slug;
  }
  if (!derived.problemId) {
    derived.problemId = problemId;
  }
  if (!derived.title && typeof fallbackMetadata?.title === 'string') {
    derived.title = fallbackMetadata.title;
  }
  if (!derived.entryFunction && typeof fallbackMetadata?.entryFunction === 'string') {
    derived.entryFunction = fallbackMetadata.entryFunction;
  }
  if (!derived.entryFunction && starterEntryFunction) {
    derived.entryFunction = starterEntryFunction;
  }
  if (!derived.language && typeof fallbackMetadata?.language === 'string') {
    derived.language = fallbackMetadata.language;
  }
  if (!derived.visibility && typeof fallbackMetadata?.visibility === 'string') {
    derived.visibility = fallbackMetadata.visibility;
  }
  if (!derived.timeLimitMs && Number.isInteger(fallbackMetadata?.timeLimitMs)) {
    derived.timeLimitMs = fallbackMetadata.timeLimitMs;
  }
  if (!derived.memoryLimitKb && Number.isInteger(fallbackMetadata?.memoryLimitKb)) {
    derived.memoryLimitKb = fallbackMetadata.memoryLimitKb;
  }
  if (!Array.isArray(derived.examples)) {
    derived.examples = [];
  }

  return derived;
}

function validateRequiredManifestFields(manifest) {
  const requiredFields = [
    'problemId',
    'title',
    'language',
    'entryFunction',
    'timeLimitMs',
    'memoryLimitKb',
    'visibility'
  ];

  return requiredFields.filter((field) => manifest[field] === undefined || manifest[field] === null || manifest[field] === '');
}

export function migrateProblemDirectory(problemDir, options = {}) {
  const write = options.write ?? true;
  const manifestPath = path.join(problemDir, 'manifest.json');
  const starterPath = path.join(problemDir, 'starter.py');
  const hiddenPath = path.join(problemDir, 'hidden.json');
  const legacyMetadataPath = path.join(problemDir, 'problem.json');

  const starterSource = fs.readFileSync(starterPath, 'utf8');
  const legacyMetadata = loadOptionalJson(legacyMetadataPath);
  const manifest = fillManifestDefaults(
    loadOptionalJson(manifestPath) ?? {},
    legacyMetadata,
    starterSource,
    problemDir
  );
  const report = {
    problemId: String(manifest.problemId ?? path.basename(problemDir)),
    doctestFound: false,
    publicTestsExtracted: 0,
    starterCleaned: false,
    manifestUpdated: false,
    hiddenJsonExists: fs.existsSync(hiddenPath),
    manualReview: []
  };

  const missingFields = validateRequiredManifestFields(manifest);
  if (missingFields.length > 0) {
    report.manualReview.push(`Manifest missing required fields: ${missingFields.join(', ')}`);
    return report;
  }

  const extracted = extractDoctestCases(starterSource, manifest.entryFunction);
  report.doctestFound = extracted.doctestFound;
  report.publicTestsExtracted = extracted.cases.length;
  report.manualReview.push(...extracted.manualReview);

  if (!extracted.doctestFound) {
    return report;
  }

  if (extracted.manualReview.length > 0 || extracted.cases.length === 0) {
    return report;
  }

  const merged = mergeManifestPublicTests(manifest, extracted.cases);
  report.manifestUpdated = merged.updated;
  report.manualReview.push(...merged.manualReview);
  if (merged.manualReview.length > 0) {
    return report;
  }

  report.starterCleaned = extracted.cleanedStarter !== starterSource;

  if (write) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(merged.manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(starterPath, extracted.cleanedStarter, 'utf8');
  }

  const validatedStarter = write ? fs.readFileSync(starterPath, 'utf8') : extracted.cleanedStarter;
  const validatedManifest = write ? loadJson(manifestPath) : merged.manifest;

  if (/^\s*>>>/m.test(validatedStarter)) {
    report.manualReview.push('starter.py still contains doctest prompts after migration');
  }
  if (!Array.isArray(validatedManifest.publicTests)) {
    report.manualReview.push('manifest.json does not contain publicTests after migration');
  } else if (validatedManifest.publicTests.length !== extracted.cases.length) {
    report.manualReview.push('manifest.json publicTests count does not match extracted doctest count');
  }
  if (!report.hiddenJsonExists) {
    report.manualReview.push('hidden.json is missing');
  }

  return report;
}

export function migrateProblemRoots(options = {}) {
  const roots = options.roots ?? ['problems', 'data/problems'];
  const write = options.write ?? true;
  const report = findProblemDirectories(roots).map((problemDir) => ({
    root: problemDir,
    ...migrateProblemDirectory(problemDir, { write })
  }));

  const summary = {
    totalProblems: report.length,
    doctestProblems: report.filter((item) => item.doctestFound).length,
    migratedProblems: report.filter(
      (item) => item.doctestFound && item.manualReview.length === 0 && item.publicTestsExtracted > 0
    ).length,
    manualReviewProblems: report.filter((item) => item.manualReview.length > 0).length
  };

  return { summary, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const result = migrateProblemRoots(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
