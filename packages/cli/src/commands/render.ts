import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { deriveOutputPath } from '../lib/io.js';
import { loadGraph, printParseErrors } from '../lib/graph-input.js';
import { renderSvg } from '../lib/render-svg.js';
import { renderPng } from '../lib/render-png.js';

export const renderCommand = new Command('render')
  .description('Render a diagram to SVG or PNG')
  .usage('[file] [--format <svg|png>] [--output <path>] [--width <n>] [--height <n>] [--scale <n>]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('-f, --format <fmt>', 'Output format: svg or png', 'svg')
  .option('-o, --output <path>', 'Write the rendered file to this path')
  .option('--width <n>', 'Set SVG width in pixels', parseInt)
  .option('--height <n>', 'Set SVG height in pixels', parseInt)
  .option('--scale <n>', 'Multiply PNG resolution, for example 2 for @2x output', parseFloat)
  .option('-b, --background <color>', 'Background color (e.g. white, #fff, transparent). PNG defaults to white')
  .addHelpText('after', `
Notes:
  Input files can be Glypho (.g), Mermaid (.mmd, .mermaid), or Graphviz DOT (.dot, .gv).
  --width and --height affect SVG output.
  --scale affects PNG output.
  --background sets the background color. PNG defaults to white; SVG defaults to transparent.
  render never opens a browser; use glypho preview <file.svg> after writing an SVG.

Examples:
  glypho render diagram.g
  glypho render diagram.g --output diagram.svg
  glypho preview diagram.svg
  glypho render diagram.g --format png
  glypho render diagram.g --format png --output diagram@2x.png --scale 2
  glypho render diagram.g --format png -b transparent
  glypho render diagram.g -b '#eee' --output diagram.svg
  glypho render flow.mmd --output flow.svg
  glypho render graph.dot --format svg --width 1200 --height 800
`)
  .action((file: string | undefined, opts: {
    format: string;
    output?: string;
    width?: number;
    height?: number;
    scale?: number;
    background?: string;
  }) => {
    const { file: inputFile, name, graph, errors } = loadGraph(file);

    if (errors.length > 0) {
      printParseErrors(name, errors);
      process.exitCode = 1;
      return;
    }

    if (opts.format === 'png') {
      const bg = opts.background ?? 'white';
      const svg = renderSvg(graph, { width: opts.width, height: opts.height });
      const png = renderPng(svg, { scale: opts.scale, background: bg });
      const outPath = opts.output ?? deriveOutputPath(inputFile, '.png');
      writeFileSync(outPath, png);
      console.log(`→ ${outPath}`);
    } else {
      const svg = renderSvg(graph, { width: opts.width, height: opts.height, background: opts.background });
      const outPath = opts.output ?? deriveOutputPath(inputFile, '.svg');
      writeFileSync(outPath, svg);
      console.log(`→ ${outPath}`);
    }
  });
