import { Command } from 'commander';
import { graphToMermaid } from '@glypho/parser';
import { loadGraph, printParseErrors } from '../../lib/graph-input.js';
import { FROM_HELP } from '../../lib/detect-format.js';

export const toMermaidCommand = new Command('mermaid')
  .description('Convert .g to Mermaid format')
  .usage('[file]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('--from <format>', FROM_HELP)
  .addHelpText('after', `
Examples:
  glypho to mermaid diagram.g
  cat diagram.g | glypho to mermaid
`)
  .action((file: string | undefined, opts: { from?: string }) => {
    const { name, graph, errors } = loadGraph(file, opts.from);

    if (errors.length > 0) {
      printParseErrors(name, errors);
      process.exitCode = 1;
      return;
    }

    console.log(graphToMermaid(graph));
  });
