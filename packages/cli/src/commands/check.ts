import { Command } from 'commander';
import { parse } from '@glypho/parser';
import { formatInputName, readInput, resolveInputFile } from '../lib/io.js';
import { printParseErrors } from '../lib/graph-input.js';

export const checkCommand = new Command('check')
  .description('Validate a .g file')
  .usage('[file] [--json]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('--json', 'Print machine-readable validation output')
  .addHelpText('after', `
Examples:
  glypho check diagram.g
  glypho check --json diagram.g
  cat diagram.g | glypho check
`)
  .action((file: string | undefined, opts: { json?: boolean }) => {
    const inputFile = resolveInputFile(file);
    const input = readInput(inputFile);
    const { graph, errors } = parse(input);
    const name = formatInputName(inputFile);

    if (opts.json) {
      const result = {
        ok: errors.length === 0,
        file: name,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        errors: errors.map(e => ({
          line: e.line,
          column: e.column ?? 1,
          message: e.message,
        })),
      };
      console.log(JSON.stringify(result));
      if (errors.length > 0) process.exitCode = 1;
    } else if (errors.length === 0) {
      console.log(`ok: ${name} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
    } else {
      printParseErrors(name, errors);
      console.error(`${errors.length} error${errors.length > 1 ? 's' : ''}`);
      process.exitCode = 1;
    }
  });
