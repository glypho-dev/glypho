import { describe, it, expect } from 'vitest';
import { graphToJsonCanvas } from '../src/json-canvas.js';
import type { Graph } from '../src/types.js';

function emptyGraph(overrides: Partial<Graph> = {}): Graph {
  return { nodes: [], edges: [], groups: [], positions: [], styles: [], ...overrides };
}

describe('graphToJsonCanvas', () => {
  it('returns valid JSON', () => {
    const graph = emptyGraph();
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
  });

  it('includes node labels', () => {
    const graph = emptyGraph({ nodes: [{ id: 'a', label: 'Hello' }] });
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result.nodes[0].text).toBe('Hello');
  });

  it('uses id as label fallback', () => {
    const graph = emptyGraph({ nodes: [{ id: 'mynode' }] });
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result.nodes[0].text).toBe('mynode');
  });

  it('includes node colors', () => {
    const graph = emptyGraph({ nodes: [{ id: 'a', color: '#f00' }] });
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result.nodes[0].color).toBe('#f00');
  });

  it('maps edges correctly', () => {
    const graph = emptyGraph({
      edges: [{ from: 'a', to: 'b', op: '>', label: 'test' }],
    });
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result.edges[0].fromNode).toBe('a');
    expect(result.edges[0].toNode).toBe('b');
    expect(result.edges[0].label).toBe('test');
  });

  it('uses explicit positions when available', () => {
    const graph = emptyGraph({
      nodes: [{ id: 'a' }],
      positions: [{ id: 'a', x: 50, y: 100, width: 200, height: 80 }],
    });
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result.nodes[0].x).toBe(50);
    expect(result.nodes[0].y).toBe(100);
    expect(result.nodes[0].width).toBe(200);
    expect(result.nodes[0].height).toBe(80);
  });

  it('generates sequential positions for nodes without explicit positions', () => {
    const graph = emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    });
    const result = JSON.parse(graphToJsonCanvas(graph));
    // Each node should have different x/y
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[0].x).toBeDefined();
    expect(result.nodes[1].x).toBeDefined();
  });

  it('omits color when not set', () => {
    const graph = emptyGraph({ nodes: [{ id: 'a' }] });
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result.nodes[0].color).toBeUndefined();
  });

  it('omits edge label when not set', () => {
    const graph = emptyGraph({
      edges: [{ from: 'a', to: 'b', op: '>' }],
    });
    const result = JSON.parse(graphToJsonCanvas(graph));
    expect(result.edges[0].label).toBeUndefined();
  });
});
