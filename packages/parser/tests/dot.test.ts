import { describe, it, expect } from 'vitest';
import { graphToDot } from '../src/dot.js';
import type { Graph } from '../src/types.js';

function emptyGraph(overrides: Partial<Graph> = {}): Graph {
  return { nodes: [], edges: [], groups: [], positions: [], styles: [], ...overrides };
}

describe('graphToDot', () => {
  it('produces digraph for directed edges', () => {
    const graph = emptyGraph({
      edges: [{ from: 'a', to: 'b', op: '>' }],
    });
    expect(graphToDot(graph)).toContain('digraph {');
  });

  it('produces graph for undirected edges only', () => {
    const graph = emptyGraph({
      edges: [{ from: 'a', to: 'b', op: '--' }],
    });
    expect(graphToDot(graph)).toContain('graph {');
    expect(graphToDot(graph)).toContain('a -- b');
  });

  it('includes rankdir', () => {
    const graph = emptyGraph({ direction: 'LR' });
    expect(graphToDot(graph)).toContain('rankdir=LR');
  });

  it('maps shapes correctly', () => {
    const shapes = [
      { shape: 'r' as const, expected: 'shape=box' },
      { shape: 'd' as const, expected: 'shape=diamond' },
      { shape: 'c' as const, expected: 'shape=circle' },
      { shape: 'o' as const, expected: 'shape=ellipse' },
      { shape: 'h' as const, expected: 'shape=hexagon' },
    ];
    for (const { shape, expected } of shapes) {
      const graph = emptyGraph({ nodes: [{ id: 'n', shape }] });
      expect(graphToDot(graph)).toContain(expected);
    }
  });

  it('maps pill shape to rounded box', () => {
    const graph = emptyGraph({ nodes: [{ id: 'n', shape: 'p' }] });
    const dot = graphToDot(graph);
    expect(dot).toContain('shape=box');
    expect(dot).toContain('rounded');
  });

  it('handles node colors', () => {
    const graph = emptyGraph({ nodes: [{ id: 'n', color: '#f00' }] });
    const dot = graphToDot(graph);
    expect(dot).toContain('fillcolor="#f00"');
    expect(dot).toContain('style=filled');
  });

  it('emits edge styles', () => {
    const graph = emptyGraph({
      edges: [
        { from: 'a', to: 'b', op: '~' },
        { from: 'c', to: 'd', op: '=' },
        { from: 'e', to: 'f', op: '<>' },
      ],
    });
    const dot = graphToDot(graph);
    expect(dot).toContain('style=dashed');
    expect(dot).toContain('style=bold');
    expect(dot).toContain('dir=both');
  });

  it('emits edge labels', () => {
    const graph = emptyGraph({
      edges: [{ from: 'a', to: 'b', op: '>', label: 'yes' }],
    });
    expect(graphToDot(graph)).toContain('label="yes"');
  });

  it('emits groups as subgraphs', () => {
    const graph = emptyGraph({
      nodes: [{ id: 'x' }, { id: 'y' }],
      groups: [{ id: 'g1', label: 'Group 1', members: ['x', 'y'] }],
    });
    const dot = graphToDot(graph);
    expect(dot).toContain('subgraph cluster_g1');
    expect(dot).toContain('label="Group 1"');
  });

  it('places grouped nodes inside subgraph only', () => {
    const graph = emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      groups: [{ id: 'g', members: ['a'] }],
    });
    const dot = graphToDot(graph);
    // 'a' should appear inside subgraph, 'b' outside
    const subgraphSection = dot.slice(dot.indexOf('subgraph'), dot.indexOf('}', dot.indexOf('subgraph')) + 1);
    expect(subgraphSection).toContain('a [');
    // 'b' should be at top level
    const afterSubgraph = dot.slice(dot.indexOf('}', dot.indexOf('subgraph')) + 1);
    expect(afterSubgraph).toContain('b [');
  });
});
