// Every spec example must survive serialization and conversion through
// Mermaid and DOT, coming back as valid .g with the same graph shape.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import {
  parse, parseMermaid, parseDot, graphToGlypho, graphToMermaid, graphToDot, flattenGroups,
} from '../src/index.js';
import type { Graph } from '../src/types.js';

const EXAMPLES_DIR = resolve(import.meta.dirname, '../../../spec/examples');
const EXAMPLES = readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.g')).sort();

function load(name: string): Graph {
  const { graph, errors } = parse(readFileSync(resolve(EXAMPLES_DIR, name), 'utf-8'));
  expect(errors).toEqual([]);
  return graph;
}

/** Re-parse the importer's result as .g text, as `glypho from …` users would */
function reparse(graph: Graph): Graph {
  const { graph: again, errors } = parse(graphToGlypho(graph));
  expect(errors).toEqual([]);
  return again;
}

/** Drop parser line numbers, and labels equal to the id (the serializer omits those) */
function normalizedNodes(graph: Graph) {
  return graph.nodes.map(({ line: _, ...n }) => (n.label === n.id ? { ...n, label: undefined } : n));
}

function shape(graph: Graph) {
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    groups: flattenGroups(graph.groups).length,
  };
}

describe('spec examples round-trip', () => {
  for (const name of EXAMPLES) {
    describe(name, () => {
      it('graphToGlypho → parse reproduces the graph', () => {
        const graph = load(name);
        const again = reparse(graph);
        expect(again.direction).toEqual(graph.direction);
        expect(normalizedNodes(again)).toEqual(normalizedNodes(graph));
        expect(again.edges.map(({ line: _, ...e }) => e))
          .toEqual(graph.edges.map(({ line: _, ...e }) => e));
        expect(again.styles.map(s => s.properties)).toEqual(graph.styles.map(s => s.properties));
        expect(shape(again)).toEqual(shape(graph));
      });

      it('survives .g → Mermaid → .g', () => {
        const graph = load(name);
        const { graph: imported, errors } = parseMermaid(graphToMermaid(graph));
        expect(errors).toEqual([]);
        expect(shape(reparse(imported))).toEqual(shape(graph));
      });

      it('survives .g → DOT → .g', () => {
        const graph = load(name);
        const { graph: imported, errors } = parseDot(graphToDot(graph));
        expect(errors).toEqual([]);
        const again = reparse(imported);
        expect(again.nodes.length).toBe(graph.nodes.length);
        expect(again.edges.length).toBe(graph.edges.length);
      });
    });
  }

  it('keeps the Mermaid-reserved id "end" through .g → Mermaid → .g', () => {
    const { graph } = parseMermaid(graphToMermaid(load('full-example.g')));
    expect(graph.nodes.map(n => n.id)).toContain('end');
    expect(graph.nodes.map(n => n.id)).not.toContain('_end');
  });
});
