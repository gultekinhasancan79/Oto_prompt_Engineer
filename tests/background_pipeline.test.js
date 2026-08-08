const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// background.js is a Chrome service worker rather than a Node module.
// Provide the minimal extension API surface needed while loading the file,
// then expose only the pure pipeline helpers we want to exercise.
global.chrome = {
  commands: {
    onCommand: { addListener() {} },
  },
  tabs: {
    query() {},
    sendMessage() {},
  },
  runtime: {
    onMessage: { addListener() {} },
  },
  storage: {
    local: {
      async get() { return {}; },
      set() {},
    },
  },
};

const backgroundPath = path.join(__dirname, '..', 'background.js');
const source = fs.readFileSync(backgroundPath, 'utf8');
const instrumentedSource = `${source}\n;global.__pipelineTestExports = {\n  stripControlBlocks,\n  metaTextCleaner,\n  validateOutput,\n  normalizeOutput,\n  detectLanguage\n};`;

vm.runInThisContext(instrumentedSource, { filename: backgroundPath });

const {
  stripControlBlocks,
  metaTextCleaner,
  validateOutput,
  normalizeOutput,
  detectLanguage,
} = global.__pipelineTestExports;

test('stripControlBlocks removes pipeline metadata without touching prompt content', () => {
  const input = [
    'TASK: PROMPT_REFINEMENT',
    'PROMPT_STATE: RAW',
    'REFINEMENT_LEVEL: 0',
    'INPUT_LANGUAGE: ENGLISH',
    'OUTPUT_LANGUAGE: ENGLISH',
    '',
    'PROMPT:',
    '"""',
    'Write focused tests for the parser.',
    '"""',
  ].join('\n');

  assert.equal(stripControlBlocks(input), 'Write focused tests for the parser.');
});

test('metaTextCleaner removes common explanatory preambles', () => {
  const result = metaTextCleaner('Here is the improved prompt: Write a parser for log files.');

  assert.equal(result.cleaned, 'Write a parser for log files.');
  assert.equal(result.wasModified, true);
});

test('normalizeOutput normalizes newlines, blank lines, and trailing whitespace', () => {
  assert.equal(
    normalizeOutput('First line  \r\n\r\n\r\nSecond line   \n'),
    'First line\n\nSecond line'
  );
});

test('detectLanguage identifies Turkish input', () => {
  assert.equal(detectLanguage('Bu metni daha açık ve anlaşılır şekilde yaz.'), 'TURKISH');
});

test('detectLanguage falls back to English for English input', () => {
  assert.equal(detectLanguage('Rewrite this request with clearer constraints.'), 'ENGLISH');
});

test('validateOutput rejects obvious model meta-text', () => {
  const validation = validateOutput(
    'Here is the improved version of your request.',
    'Improve my request'
  );

  assert.equal(validation.isValid, false);
  assert.ok(validation.errors.length > 0);
});

test('validateOutput accepts a clean intent-preserving rewrite', () => {
  const validation = validateOutput(
    'Write a concise parser for structured log files with explicit error handling.',
    'Write a concise parser for structured log files'
  );

  assert.deepEqual(validation, { isValid: true, errors: [] });
});
