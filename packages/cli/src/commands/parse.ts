import { Command } from 'commander';
import { loadGraph, printParseErrors } from '../lib/graph-input.js';
import { FROM_HELP } from '../lib/detect-format.js';

export const parseCommand = new Command('parse')
  .description('Parse input and print its JSON AST')
  .usage('[file] [--compact] [--from <g|mermaid|dot>]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('--from <format>', FROM_HELP)
  .option('--compact', 'Print minified JSON on a single line')
  .addHelpText('after', `
Examples:
  glypho parse diagram.g
  glypho parse --compact diagram.g
  cat diagram.g | glypho parse
`)
  .action((file: string | undefined, opts: { compact?: boolean; from?: string }) => {
    const { name, graph, errors } = loadGraph(file, opts.from);

    if (errors.length > 0) {
      printParseErrors(name, errors);
      process.exitCode = 1;
      return;
    }

    const json = opts.compact
      ? JSON.stringify(graph)
      : JSON.stringify(graph, null, 2);
    console.log(json);
  });
