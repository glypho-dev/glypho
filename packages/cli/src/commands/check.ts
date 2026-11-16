import { Command } from 'commander';
import { loadGraph, printParseErrors } from '../lib/graph-input.js';
import { FROM_HELP } from '../lib/detect-format.js';

export const checkCommand = new Command('check')
  .description('Validate a .g, Mermaid, or DOT file')
  .usage('[file] [--json] [--from <g|mermaid|dot>]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('--from <format>', FROM_HELP)
  .option('--json', 'Print machine-readable validation output')
  .addHelpText('after', `
Examples:
  glypho check diagram.g
  glypho check --json diagram.g
  cat diagram.g | glypho check
  glypho check flow.mmd
  cat graph.dot | glypho check --from dot
`)
  .action((file: string | undefined, opts: { json?: boolean; from?: string }) => {
    const { name, graph, errors } = loadGraph(file, opts.from);

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
