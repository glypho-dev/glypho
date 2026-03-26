import { Command } from 'commander';
import { parse } from '@glypho/parser';
import { formatInputName, readInput, resolveInputFile } from '../lib/io.js';
import { printParseErrors } from '../lib/graph-input.js';

export const parseCommand = new Command('parse')
  .description('Parse Glypho input and print its JSON AST')
  .usage('[file] [--compact]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('--compact', 'Print minified JSON on a single line')
  .addHelpText('after', `
Examples:
  glypho parse diagram.g
  glypho parse --compact diagram.g
  cat diagram.g | glypho parse
`)
  .action((file: string | undefined, opts: { compact?: boolean }) => {
    const inputFile = resolveInputFile(file);
    const input = readInput(inputFile);
    const { graph, errors } = parse(input);

    if (errors.length > 0) {
      printParseErrors(formatInputName(inputFile), errors);
      process.exitCode = 1;
      return;
    }

    const json = opts.compact
      ? JSON.stringify(graph)
      : JSON.stringify(graph, null, 2);
    console.log(json);
  });
