import { Command } from 'commander';
import { parse, graphToMermaid, graphToGlypho, graphToDot, graphToJsonCanvas, flattenGroups } from '@glypho/parser';
import { formatInputName, readInput, resolveInputFile } from '../lib/io.js';
import { printParseErrors } from '../lib/graph-input.js';

export const infoCommand = new Command('info')
  .description('Show stats and token comparison')
  .usage('[file] [--json]')
  .argument('[file]', 'Input file (defaults to stdin when piped; use - for stdin)')
  .option('--json', 'Print machine-readable stats and token counts')
  .addHelpText('after', `
Examples:
  glypho info diagram.g
  glypho info --json diagram.g
  cat diagram.g | glypho info
`)
  .action(async (file: string | undefined, opts: { json?: boolean }) => {
    const inputFile = resolveInputFile(file);
    const input = readInput(inputFile);
    const { graph, errors } = parse(input);
    const name = formatInputName(inputFile);

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
