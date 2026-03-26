import { Command } from 'commander';
import { parseMermaid, graphToGlypho } from '@glypho/parser';
import { formatInputName, readInput, resolveInputFile } from '../../lib/io.js';
import { printParseErrors } from '../../lib/graph-input.js';

export const fromMermaidCommand = new Command('mermaid')
  .description('Convert Mermaid flowchart to .g format')
  .usage('[file]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .addHelpText('after', `
Examples:
  glypho from mermaid diagram.mmd
  cat diagram.mmd | glypho from mermaid
`)
  .action((file: string | undefined) => {
    const inputFile = resolveInputFile(file);
    const input = readInput(inputFile);
    const { graph, errors } = parseMermaid(input);

    if (errors.length > 0) {
      printParseErrors(formatInputName(inputFile), errors);
      process.exitCode = 1;
      return;
    }

    console.log(graphToGlypho(graph));
  });
