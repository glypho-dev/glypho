import { extname } from 'node:path';
import { Command, InvalidArgumentError } from 'commander';
import { deriveOutputPath, writeOutput } from '../lib/io.js';
import { loadGraph, printParseErrors } from '../lib/graph-input.js';
import { FROM_HELP } from '../lib/detect-format.js';
import { CliError } from '../lib/errors.js';
import { renderSvg } from '../lib/render-svg.js';
import { renderPng, validatePngBackground } from '../lib/render-png.js';

type OutputFormat = 'svg' | 'png';

function positiveInteger(value: string): number {
  if (!/^\d+$/.test(value.trim()) || Number(value) <= 0) {
    throw new InvalidArgumentError('expected a positive integer.');
  }
  return Number(value);
}

function positiveNumber(value: string): number {
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n) || n <= 0) {
    throw new InvalidArgumentError('expected a positive number.');
  }
  return n;
}

function formatFromPath(path: string): OutputFormat | undefined {
  const ext = extname(path).toLowerCase();
  if (ext === '.svg') return 'svg';
  if (ext === '.png') return 'png';
  return undefined;
}

function resolveOutputFormat(format: string | undefined, output: string | undefined): OutputFormat {
  const fromOutput = output ? formatFromPath(output) : undefined;
  if (format === undefined) return fromOutput ?? 'svg';
  const normalized = format.toLowerCase();
  if (normalized !== 'svg' && normalized !== 'png') {
    throw new CliError(`invalid --format '${format}' (valid values: svg, png)`);
  }
  if (fromOutput && fromOutput !== normalized) {
    throw new CliError(`--format ${normalized} conflicts with --output ${output}; use a .${normalized} output path or drop --format`);
  }
  return normalized;
}

export const renderCommand = new Command('render')
  .description('Render a diagram to SVG or PNG')
  .usage('[file] [--format <svg|png>] [--output <path>] [--from <g|mermaid|dot>] [--width <n>] [--height <n>] [--scale <n>]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('-f, --format <fmt>', 'Output format: svg or png (default: from --output extension, else svg)')
  .option('-o, --output <path>', 'Write the rendered file to this path (parent directories are created)')
  .option('--from <format>', FROM_HELP)
  .option('--width <n>', 'Set SVG width in pixels', positiveInteger)
  .option('--height <n>', 'Set SVG height in pixels', positiveInteger)
  .option('--scale <n>', 'Multiply PNG resolution, for example 2 for @2x output', positiveNumber)
  .option('-b, --background <color>', 'Background color (e.g. white, #fff, transparent). PNG defaults to white')
  .addHelpText('after', `
Notes:
  Input files can be Glypho (.g), Mermaid (.mmd, .mermaid), or Graphviz DOT (.dot, .gv).
  Use --from to set the input format for stdin or other extensions.
  The output format follows the --output extension (.svg or .png) unless --format is given.
  --width and --height affect SVG output.
  --scale affects PNG output.
  --background sets the background color. PNG defaults to white; SVG defaults to transparent.
  render never opens a browser; use glypho preview <file.svg> after writing an SVG.

Examples:
  glypho render diagram.g
  glypho render diagram.g --output diagram.svg
  glypho preview diagram.svg
  glypho render diagram.g --format png
  glypho render diagram.g --output out/diagram.png
  cat flow.mmd | glypho render --from mermaid --output flow.svg
  glypho render diagram.g --format png --output diagram@2x.png --scale 2
  glypho render diagram.g --format png -b transparent
  glypho render diagram.g -b '#eee' --output diagram.svg
  glypho render flow.mmd --output flow.svg
  glypho render graph.dot --format svg --width 1200 --height 800
`)
  .action((file: string | undefined, opts: {
    format?: string;
    from?: string;
    output?: string;
    width?: number;
    height?: number;
    scale?: number;
    background?: string;
  }) => {
    const format = resolveOutputFormat(opts.format, opts.output);
    if (format === 'svg' && opts.scale !== undefined) {
      console.error('warning: --scale only applies to PNG output; ignoring it for SVG (use --width/--height)');
    }
    if (format === 'png' && opts.background !== undefined) {
      validatePngBackground(opts.background);
    }

    const { file: inputFile, name, graph, errors } = loadGraph(file, opts.from);

    if (errors.length > 0) {
      printParseErrors(name, errors);
      process.exitCode = 1;
      return;
    }

    if (format === 'png') {
      const bg = opts.background ?? 'white';
      const svg = renderSvg(graph, { width: opts.width, height: opts.height });
      const png = renderPng(svg, { scale: opts.scale, background: bg });
      const outPath = opts.output ?? deriveOutputPath(inputFile, '.png');
      writeOutput(outPath, png, inputFile);
      console.log(`→ ${outPath}`);
    } else {
      const svg = renderSvg(graph, { width: opts.width, height: opts.height, background: opts.background });
      const outPath = opts.output ?? deriveOutputPath(inputFile, '.svg');
      writeOutput(outPath, svg, inputFile);
      console.log(`→ ${outPath}`);
    }
  });
