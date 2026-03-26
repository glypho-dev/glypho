import { Command } from 'commander';
import { parseDot, graphToGlypho } from '@glypho/parser';
import { formatInputName, readInput, resolveInputFile } from '../../lib/io.js';
import { printParseErrors } from '../../lib/graph-input.js';

export const fromDotCommand = new Command('dot')
  .description('Convert Graphviz DOT to .g format')
  .usage('[file]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .addHelpText('after', `
Examples:
  glypho from dot graph.dot
  cat graph.dot | glypho from dot
`)
  .action((file: string | undefined) => {
    const inputFile = resolveInputFile(file);
    const input = readInput(inputFile);
    const { graph, errors } = parseDot(input);

    if (errors.length > 0) {
      printParseErrors(formatInputName(inputFile), errors);
      process.exitCode = 1;
      return;
    }

    console.log(graphToGlypho(graph));
  });
