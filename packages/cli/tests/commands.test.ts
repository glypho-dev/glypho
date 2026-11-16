import { describe, it, expect, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, unlinkSync, readFileSync, writeFileSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const ROOT = resolve(PKG_ROOT, '../..');
const CLI = `node ${join(PKG_ROOT, 'dist/index.js')}`;
const EXAMPLES = join(ROOT, 'spec/examples');

/** Files created during tests that should be cleaned up */
const cleanup: string[] = [];

function run(args: string, opts: { input?: string; expectFail?: boolean } = {}): string {
  try {
    const result = execSync(`${CLI} ${args}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      input: opts.input,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (e: any) {
    if (opts.expectFail) {
      return e.stderr || e.stdout || '';
    }
    throw e;
  }
}

function runWithStderr(args: string, opts: { input?: string } = {}): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      input: opts.input,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (e: any) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', status: e.status || 1 };
  }
}

function runCapture(args: string, opts: { input?: string } = {}): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(`${CLI} ${args}`, {
    cwd: ROOT,
    encoding: 'utf-8',
    input: opts.input,
    shell: true,
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status ?? 1 };
}

afterAll(() => {
  for (const f of cleanup) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch {
      // ignore cleanup errors
    }
  }
});

// ---------------------------------------------------------------------------
// check command
// ---------------------------------------------------------------------------
describe('check', () => {
  it('validates a .g file and prints node/edge counts', () => {
    const out = run(`check ${join(EXAMPLES, 'flowchart.g')}`);
    expect(out).toContain('ok:');
    expect(out).toContain('9 nodes');
    expect(out).toContain('10 edges');
  });

  it('reads from stdin when no file is provided', () => {
    const out = run('check', { input: '>LR\na:r Hello\nb:r World\na>b\n' });
    expect(out).toContain('2 nodes');
    expect(out).toContain('1 edges');
    expect(out).toContain('<stdin>');
  });

  it('outputs valid JSON with --json flag', () => {
    const out = run(`check --json ${join(EXAMPLES, 'flowchart.g')}`);
    const json = JSON.parse(out);
    expect(json).toHaveProperty('ok', true);
    expect(json).toHaveProperty('file');
    expect(json).toHaveProperty('nodes');
    expect(json).toHaveProperty('edges');
    expect(json).toHaveProperty('errors');
    expect(json.nodes).toBe(9);
    expect(json.edges).toBe(10);
    expect(json.errors).toEqual([]);
  });

  it('exits with error for invalid input', () => {
    const { stderr, status } = runWithStderr('check -', { input: '@@invalid' });
    expect(status).toBe(1);
    expect(stderr).toContain('<stdin>:1:2:');
  });

  it('returns JSON with errors array for invalid input with --json', () => {
    const { stdout, status } = runWithStderr('check --json -', { input: '@@invalid' });
    expect(status).toBe(1);
    const json = JSON.parse(stdout);
    expect(json.ok).toBe(false);
    expect(json.errors.length).toBeGreaterThan(0);
    expect(json.errors[0]).toHaveProperty('message');
    expect(json.errors[0]).toHaveProperty('line');
  });
});

describe('help output', () => {
  it('shows detailed command reference in top-level help', () => {
    const out = run('--help');
    expect(out).toContain('glypho render [file] [--format <svg|png>]');
    expect(out).toContain('glypho check [file] [--json]');
    expect(out).toContain('glypho preview <file> [--force]');
    expect(out).toContain('glypho from dot [file]');
  });

  it('shows render flags and examples in render help', () => {
    const out = run('render --help');
    expect(out).toContain('--format <fmt>');
    expect(out).toContain('Output format: svg or png');
    expect(out).toContain('render never opens a browser; use glypho preview <file.svg> after writing an SVG.');
    expect(out).toContain('glypho render diagram.g --format png --output diagram@2x.png --scale 2');
  });

  it('shows available formats in grouped command help', () => {
    const out = run('from --help');
    expect(out).toContain('glypho from mermaid [file]');
    expect(out).toContain('glypho from dot [file]');
  });

  it('shows preview safety notes in preview help', () => {
    const out = run('preview --help');
    expect(out).toContain('preview only opens an existing SVG file.');
    expect(out).toContain('glypho preview diagram.svg');
    expect(out).toContain('--force');
  });
});

// ---------------------------------------------------------------------------
// parse command
// ---------------------------------------------------------------------------
describe('parse', () => {
  it('outputs valid JSON AST for a .g file', () => {
    const out = run(`parse ${join(EXAMPLES, 'flowchart.g')}`);
    const json = JSON.parse(out);
    expect(json).toHaveProperty('nodes');
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(json.nodes.length).toBe(9);
  });

  it('outputs compact single-line JSON with --compact', () => {
    const out = run(`parse --compact ${join(EXAMPLES, 'flowchart.g')}`);
    // Compact output should be a single line (no newlines in the JSON itself)
    const lines = out.trim().split('\n');
    expect(lines.length).toBe(1);
    const json = JSON.parse(out);
    expect(json).toHaveProperty('nodes');
  });

  it('reads from stdin when no file is provided', () => {
    const out = run('parse', { input: '>TB\nx:r Foo\ny:c Bar\nx>y\n' });
    const json = JSON.parse(out);
    expect(json.nodes.length).toBe(2);
    expect(json.edges.length).toBe(1);
  });

  it('exits non-zero and does not print JSON for invalid input', () => {
    const { stdout, stderr, status } = runWithStderr('parse -', { input: '@@invalid' });
    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('<stdin>:1:2:');
  });
});

// ---------------------------------------------------------------------------
// info command
// ---------------------------------------------------------------------------
describe('info', () => {
  it('shows Nodes, Edges, Format, and Tokens sections', () => {
    const out = run(`info ${join(EXAMPLES, 'flowchart.g')}`);
    expect(out).toContain('Nodes:');
    expect(out).toContain('Edges:');
    expect(out).toContain('Format');
    expect(out).toContain('Tokens');
  });

  it('outputs valid JSON with --json including token counts', () => {
    const out = run(`info --json ${join(EXAMPLES, 'flowchart.g')}`);
    const json = JSON.parse(out);
    expect(json).toHaveProperty('tokens');
    expect(json.tokens).toHaveProperty('g');
    expect(json.tokens).toHaveProperty('mermaid');
    expect(json.tokens).toHaveProperty('dot');
    expect(json.tokens).toHaveProperty('json_canvas');
  });

  it('.g tokens < mermaid tokens < json_canvas tokens', () => {
    const out = run(`info --json ${join(EXAMPLES, 'flowchart.g')}`);
    const { tokens } = JSON.parse(out);
    expect(tokens.g).toBeLessThan(tokens.mermaid);
    expect(tokens.mermaid).toBeLessThan(tokens.json_canvas);
  });
});

// ---------------------------------------------------------------------------
// to mermaid
// ---------------------------------------------------------------------------
describe('to mermaid', () => {
  it('outputs Mermaid containing "flowchart"', () => {
    const out = run(`to mermaid ${join(EXAMPLES, 'flowchart.g')}`);
    expect(out).toContain('flowchart');
  });

  it('contains expected node definitions', () => {
    const out = run(`to mermaid ${join(EXAMPLES, 'flowchart.g')}`);
    expect(out).toContain('start');
    expect(out).toContain('login');
    expect(out).toContain('dashboard');
  });
});

// ---------------------------------------------------------------------------
// render command
// ---------------------------------------------------------------------------
describe('render', () => {
  it('creates an SVG file from a .g file', () => {
    const outPath = '/tmp/glypho-test-render.svg';
    cleanup.push(outPath);
    const out = run(`render ${join(EXAMPLES, 'flowchart.g')} -o ${outPath}`);
    expect(out).toContain(outPath);
    expect(existsSync(outPath)).toBe(true);
    const content = readFileSync(outPath, 'utf-8');
    expect(content).toContain('<svg');
  });

  it('creates a PNG file with -f png', () => {
    const outPath = '/tmp/glypho-test-render.png';
    cleanup.push(outPath);
    const out = run(`render ${join(EXAMPLES, 'flowchart.g')} -f png -o ${outPath}`);
    expect(out).toContain(outPath);
    expect(existsSync(outPath)).toBe(true);
    // PNG files start with the PNG magic bytes
    const buf = readFileSync(outPath);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // 'P'
  });

  it('writes to a specified output path with -o', () => {
    const outPath = '/tmp/glypho-test-custom-output.svg';
    cleanup.push(outPath);
    run(`render ${join(EXAMPLES, 'minimal.g')} -o ${outPath}`);
    expect(existsSync(outPath)).toBe(true);
  });

  it('renders Mermaid input to SVG', () => {
    const outPath = '/tmp/glypho-test-render-mermaid.svg';
    cleanup.push(outPath);
    const out = run(`render ${join(EXAMPLES, 'how-llms-work.mmd')} -o ${outPath}`);
    expect(out).toContain(outPath);
    expect(existsSync(outPath)).toBe(true);
  });

  it('reads from stdin when no file is provided', () => {
    const outPath = '/tmp/glypho-test-render-stdin.svg';
    cleanup.push(outPath);
    const out = run(`render -o ${outPath}`, { input: '>LR\na:r Hello\nb:r World\na>b\n' });
    expect(out).toContain(outPath);
    expect(existsSync(outPath)).toBe(true);
  });

  it('rendered SVG contains <svg tag', () => {
    const outPath = '/tmp/glypho-test-svg-tag.svg';
    cleanup.push(outPath);
    run(`render ${join(EXAMPLES, 'flowchart.g')} -o ${outPath}`);
    const content = readFileSync(outPath, 'utf-8');
    expect(content).toContain('<svg');
  });

  it('exits non-zero for invalid input', () => {
    const { stderr, status } = runWithStderr('render -', { input: '@@invalid' });
    expect(status).toBe(1);
    expect(stderr).toContain('<stdin>:1:2:');
  });

  it('exits non-zero for unknown --format values', () => {
    const outPath = '/tmp/glypho-test-bad-format.pdf';
    cleanup.push(outPath);
    const { stderr, status } = runWithStderr(
      `render ${join(EXAMPLES, 'minimal.g')} -f pdf -o ${outPath}`,
    );
    expect(status).toBe(1);
    expect(stderr).toContain("invalid --format 'pdf'");
    expect(stderr).toContain('svg, png');
    expect(existsSync(outPath)).toBe(false);
  });

  it('SVG output has no background rect by default', () => {
    const outPath = '/tmp/glypho-test-no-bg.svg';
    cleanup.push(outPath);
    run(`render ${join(EXAMPLES, 'minimal.g')} -o ${outPath}`);
    const content = readFileSync(outPath, 'utf-8');
    expect(content).not.toMatch(/fill="#eee"/);
  });

  it('SVG output includes background rect when --background is set', () => {
    const outPath = '/tmp/glypho-test-bg.svg';
    cleanup.push(outPath);
    run(`render ${join(EXAMPLES, 'minimal.g')} -b '#eee' -o ${outPath}`);
    const content = readFileSync(outPath, 'utf-8');
    expect(content).toMatch(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="#eee"\/>/);
  });

  it('PNG with --background transparent produces a valid PNG', () => {
    const outPath = '/tmp/glypho-test-bg-transparent.png';
    cleanup.push(outPath);
    run(`render ${join(EXAMPLES, 'minimal.g')} -f png -b transparent -o ${outPath}`);
    const buf = readFileSync(outPath);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });
});

// ---------------------------------------------------------------------------
// from mermaid
// ---------------------------------------------------------------------------
describe('from mermaid', () => {
  it('converts Mermaid from stdin to .g output', () => {
    const mermaid = 'flowchart LR\n    A["Hello"]\n    B["World"]\n    A --> B\n';
    const out = run('from mermaid', { input: mermaid });
    expect(out).toContain('>LR');
    expect(out).toContain('A');
    expect(out).toContain('B');
    expect(out).toContain('>');
  });

  it('converts Mermaid from a file', () => {
    // Write a temporary mermaid file
    const mmdPath = '/tmp/glypho-test-input.mmd';
    cleanup.push(mmdPath);
    writeFileSync(mmdPath, 'flowchart TB\n    X["Start"]\n    Y["End"]\n    X --> Y\n');
    const out = run(`from mermaid ${mmdPath}`);
    expect(out).toContain('>TB');
    expect(out).toContain('X');
    expect(out).toContain('Y');
  });
});

// ---------------------------------------------------------------------------
// from dot
// ---------------------------------------------------------------------------
describe('from dot', () => {
  it('converts DOT from stdin to .g output', () => {
    const dot = 'digraph {\n    rankdir=LR;\n    a [label="Hello", shape=box];\n    b [label="World", shape=box];\n    a -> b;\n}\n';
    const out = run('from dot', { input: dot });
    expect(out).toContain('>LR');
    expect(out).toContain('a:r Hello');
    expect(out).toContain('b:r World');
    expect(out).toContain('a>b');
  });

  it('converts DOT from a file', () => {
    const dotPath = '/tmp/glypho-test-input.dot';
    cleanup.push(dotPath);
    writeFileSync(dotPath, 'digraph {\n    rankdir=TB;\n    X [label="Start", shape=box];\n    Y [label="End", shape=box];\n    X -> Y;\n}\n');
    const out = run(`from dot ${dotPath}`);
    expect(out).toContain('>TB');
    expect(out).toContain('X');
    expect(out).toContain('Y');
  });

  it('handles shapes and edge labels', () => {
    const dot = 'digraph {\n    a [shape=diamond, label="Check"];\n    b [shape=circle];\n    a -> b [label="yes"];\n}\n';
    const out = run('from dot -', { input: dot });
    expect(out).toContain('a:d Check');
    expect(out).toContain('b:c');
    expect(out).toContain('a>b yes');
  });
});

// ---------------------------------------------------------------------------
// preview command
// ---------------------------------------------------------------------------
describe('preview', () => {
  it('exits non-zero for non-svg input', () => {
    const { stderr, status } = runWithStderr(`preview ${join(EXAMPLES, 'flowchart.g')}`);
    expect(status).toBe(1);
    expect(stderr).toContain('preview expects an existing .svg file');
  });

  it('exits non-zero for missing svg files', () => {
    const { stderr, status } = runWithStderr('preview /tmp/glypho-missing-preview.svg');
    expect(status).toBe(1);
    expect(stderr).toContain('file not found');
  });

  it('refuses to open a browser in non-interactive environments unless forced', () => {
    const svgPath = '/tmp/glypho-test-preview.svg';
    cleanup.push(svgPath);
    writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    const { stderr, status } = runWithStderr(`preview ${svgPath}`);
    expect(status).toBe(1);
    expect(stderr).toContain('preview refused to open a browser');
  });
});

// ---------------------------------------------------------------------------
// input / output error handling
// ---------------------------------------------------------------------------
describe('input and output errors', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'glypho-cli-test-'));
  const input = join(tmp, 'flow.g');
  copyFileSync(join(EXAMPLES, 'minimal.g'), input);
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('prints a clean error for a missing input file', () => {
    const { stderr, status } = runWithStderr(`check ${join(tmp, 'nope.g')}`);
    expect(status).toBe(1);
    expect(stderr).toContain('error: file not found:');
    expect(stderr).not.toMatch(/\n\s+at /);
  });

  it('prints a clean error when the input is a directory', () => {
    const { stderr, status } = runWithStderr(`render ${tmp}`);
    expect(status).toBe(1);
    expect(stderr).toContain('is a directory');
    expect(stderr).not.toMatch(/\n\s+at /);
  });

  it('rejects empty stdin', () => {
    const { stderr, status } = runWithStderr('check', { input: '' });
    expect(status).toBe(1);
    expect(stderr).toContain('error: <stdin> is empty');
  });

  it('rejects whitespace-only files', () => {
    const blank = join(tmp, 'blank.g');
    writeFileSync(blank, '  \n\n');
    const { stderr, status } = runWithStderr(`info ${blank}`);
    expect(status).toBe(1);
    expect(stderr).toContain('is empty');
  });

  it('creates missing output directories', () => {
    const outPath = join(tmp, 'a/b/c/out.svg');
    run(`render ${input} -o ${outPath}`);
    expect(readFileSync(outPath, 'utf-8')).toContain('<svg');
  });

  it('refuses to overwrite the input file', () => {
    const before = readFileSync(input, 'utf-8');
    const { stderr, status } = runWithStderr(`render ${input} -o ${input}`);
    expect(status).toBe(1);
    expect(stderr).toContain('refusing to overwrite the input file');
    expect(readFileSync(input, 'utf-8')).toBe(before);
  });

  it('refuses when the derived output path is the input file', () => {
    const svgInput = join(tmp, 'diagram.svg');
    writeFileSync(svgInput, '>LR\na>b\n');
    const { stderr, status } = runWithStderr(`render ${svgInput}`);
    expect(status).toBe(1);
    expect(stderr).toContain('refusing to overwrite');
    expect(readFileSync(svgInput, 'utf-8')).toBe('>LR\na>b\n');
  });

  it('prints a clean error when the output path is a directory', () => {
    const { stderr, status } = runWithStderr(`render ${input} -o ${tmp}`);
    expect(status).toBe(1);
    expect(stderr).toMatch(/^error: cannot write/m);
  });
});

// ---------------------------------------------------------------------------
// render option validation and format inference
// ---------------------------------------------------------------------------
describe('render options', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'glypho-cli-opts-'));
  const input = join(EXAMPLES, 'minimal.g');
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it.each(['abc', '0', '-5', '12px', '1.5'])('rejects --width %s', (value) => {
    const outPath = join(tmp, `w-${value}.svg`);
    const { stderr, status } = runWithStderr(`render ${input} --width=${value} -o ${outPath}`);
    expect(status).toBe(1);
    expect(stderr).toContain('expected a positive integer');
    expect(existsSync(outPath)).toBe(false);
  });

  it('uses the last value when --width is repeated', () => {
    const outPath = join(tmp, 'repeat.svg');
    run(`render ${input} --width 100 --width 200 -o ${outPath}`);
    const svg = readFileSync(outPath, 'utf-8');
    expect(svg).toMatch(/<svg[^>]*\bwidth="200"/);
    expect(svg).not.toContain('NaN');
  });

  it.each(['abc', '0', '-1', 'Infinity'])('rejects --scale %s', (value) => {
    const outPath = join(tmp, `s-${value}.png`);
    const { stderr, status } = runWithStderr(`render ${input} -f png --scale=${value} -o ${outPath}`);
    expect(status).toBe(1);
    expect(stderr).toContain('expected a positive number');
    expect(stderr).not.toMatch(/\n\s+at /);
    expect(existsSync(outPath)).toBe(false);
  });

  it('rejects an invalid PNG background color cleanly', () => {
    const outPath = join(tmp, 'bad-bg.png');
    const { stderr, status } = runWithStderr(`render ${input} -f png -b notacolor -o ${outPath}`);
    expect(status).toBe(1);
    expect(stderr).toContain("invalid --background color 'notacolor'");
    expect(existsSync(outPath)).toBe(false);
  });

  it('infers PNG from the --output extension', () => {
    const outPath = join(tmp, 'inferred.png');
    run(`render ${input} -o ${outPath}`);
    const buf = readFileSync(outPath);
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('rejects a --format that conflicts with the --output extension', () => {
    const outPath = join(tmp, 'conflict.png');
    const { stderr, status } = runWithStderr(`render ${input} -f svg -o ${outPath}`);
    expect(status).toBe(1);
    expect(stderr).toContain('conflicts with --output');
    expect(existsSync(outPath)).toBe(false);
  });

  it('warns that --scale is ignored for SVG output', () => {
    const outPath = join(tmp, 'scale.svg');
    const { stderr } = runCapture(`render ${input} --scale 2 -o ${outPath}`);
    expect(stderr).toContain('--scale only applies to PNG');
    expect(existsSync(outPath)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// input format selection
// ---------------------------------------------------------------------------
describe('input formats', () => {
  const mermaid = 'flowchart LR\n  a --> b\n  b --> c\n';
  const dot = 'digraph { a -> b; b -> c; }\n';

  it('check detects Mermaid by extension', () => {
    const out = run(`check ${join(EXAMPLES, 'how-llms-work.mmd')}`);
    expect(out).toMatch(/^ok: /);
  });

  it('info detects DOT by extension', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'glypho-cli-dot-'));
    try {
      const file = join(tmp, 'graph.dot');
      writeFileSync(file, dot);
      const json = JSON.parse(run(`info --json ${file}`));
      expect(json.nodes).toBe(3);
      expect(json.edges).toBe(2);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('check --from mermaid reads Mermaid from stdin', () => {
    const out = run('check --from mermaid', { input: mermaid });
    expect(out).toContain('3 nodes, 2 edges');
  });

  it('parse --from dot reads DOT from stdin', () => {
    const graph = JSON.parse(run('parse --compact --from dot', { input: dot }));
    expect(graph.nodes).toHaveLength(3);
  });

  it('render --from mermaid renders stdin', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'glypho-cli-from-'));
    try {
      const outPath = join(tmp, 'flow.svg');
      run(`render --from mermaid -o ${outPath}`, { input: mermaid });
      expect(readFileSync(outPath, 'utf-8')).toContain('<svg');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('stdin without --from is still parsed as .g', () => {
    const { status } = runWithStderr('check', { input: mermaid });
    expect(status).toBe(1);
  });

  it('rejects an unknown --from value', () => {
    const { stderr, status } = runWithStderr('check --from yaml', { input: '>LR\na>b\n' });
    expect(status).toBe(1);
    expect(stderr).toContain("invalid --from 'yaml'");
  });
});

// ---------------------------------------------------------------------------
// version
// ---------------------------------------------------------------------------
describe('--version', () => {
  it('prints the version from package.json', () => {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf-8'));
    expect(run('--version').trim()).toBe(pkg.version);
  });
});
