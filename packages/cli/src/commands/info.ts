import { Command } from 'commander';
import { graphToMermaid, graphToGlypho, graphToDot, graphToJsonCanvas, flattenGroups } from '@glypho/parser';
import { loadGraph, printParseErrors } from '../lib/graph-input.js';
import { FROM_HELP } from '../lib/detect-format.js';

export const infoCommand = new Command('info')
  .description('Show stats and token comparison')
  .usage('[file] [--json] [--from <g|mermaid|dot>]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('--from <format>', FROM_HELP)
  .option('--json', 'Print machine-readable stats and token counts')
  .addHelpText('after', `
Examples:
  glypho info diagram.g
  glypho info --json diagram.g
  cat diagram.g | glypho info
  cat flow.mmd | glypho info --from mermaid
`)
  .action(async (file: string | undefined, opts: { json?: boolean; from?: string }) => {
    const { name, graph, errors } = loadGraph(file, opts.from);

    if (errors.length > 0) {
      printParseErrors(name, errors);
      process.exitCode = 1;
      return;
    }

    // Generate all formats
    const glyphoText = graphToGlypho(graph);
    const mermaidText = graphToMermaid(graph);
    const dotText = graphToDot(graph);
    const jsonCanvasText = graphToJsonCanvas(graph);

    // Count tokens using gpt-tokenizer
    const { encode } = await import('gpt-tokenizer');
    const tokens = {
      g: encode(glyphoText).length,
      mermaid: encode(mermaidText).length,
      dot: encode(dotText).length,
      json_canvas: encode(jsonCanvasText).length,
    };

    if (opts.json) {
      console.log(JSON.stringify({
        file: name,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        groups: flattenGroups(graph.groups).length,
        tokens,
      }));
    } else {
      console.log(name);
      console.log(`  Nodes: ${graph.nodes.length}   Edges: ${graph.edges.length}   Groups: ${flattenGroups(graph.groups).length}`);
      console.log('');
      console.log('  Format        Tokens');

      const base = tokens.g;
      const fmt = (label: string, count: number) => {
        const ratio = base > 0 ? (count / base).toFixed(1) : '?';
        const pad = ' '.repeat(Math.max(0, 14 - label.length));
        if (label === '.g') {
          return `  ${label}${pad}${String(count).padStart(6)}`;
        }
        return `  ${label}${pad}${String(count).padStart(6)}  (${ratio}x)`;
      };

      console.log(fmt('.g', tokens.g));
      console.log(fmt('Mermaid', tokens.mermaid));
      console.log(fmt('Graphviz DOT', tokens.dot));
      console.log(fmt('JSON Canvas', tokens.json_canvas));
    }
  });
