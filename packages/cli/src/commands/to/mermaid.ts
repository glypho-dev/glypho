import { Command } from 'commander';
import { parse, graphToMermaid } from '@glypho/parser';
import { formatInputName, readInput, resolveInputFile } from '../../lib/io.js';
import { printParseErrors } from '../../lib/graph-input.js';

export const toMermaidCommand = new Command('mermaid')
  .description('Convert .g to Mermaid format')
  .usage('[file]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .addHelpText('after', `
Examples:
  glypho to mermaid diagram.g
  cat diagram.g | glypho to mermaid
`)
  .action((file: string | undefined) => {
    const inputFile = resolveInputFile(file);
    const input = readInput(inputFile);
    const { graph, errors } = parse(input);

    if (errors.length > 0) {
      printParseErrors(formatInputName(inputFile), errors);
      process.exitCode = 1;
      return;
    }

    console.log(graphToMermaid(graph));
  });
