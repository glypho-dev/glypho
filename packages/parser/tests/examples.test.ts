import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '../src/index.js';

const EXAMPLES_DIR = resolve(import.meta.dirname, '../../../spec/examples');

function parseFile(name: string) {
  const content = readFileSync(resolve(EXAMPLES_DIR, name), 'utf-8');
  return parse(content);
}

describe('example files', () => {
  it('parses minimal.g with zero errors', () => {
    const { graph, errors } = parseFile('minimal.g');
    expect(errors).toEqual([]);
    // Only "a>b" is uncommented — 2 nodes, 1 edge
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: 'a', to: 'b', op: '>' });
  });

  it('parses flowchart.g with zero errors', () => {
    const { graph, errors } = parseFile('flowchart.g');
    expect(errors).toEqual([]);
    expect(graph.direction).toBe('LR');
    expect(graph.nodes).toHaveLength(9);
    expect(graph.edges).toHaveLength(10);
    expect(graph.groups).toHaveLength(2);
  });

  it('parses mindmap.g with zero errors', () => {
    const { graph, errors } = parseFile('mindmap.g');
    expect(errors).toEqual([]);
    expect(graph.direction).toBe('TB');
    expect(graph.nodes).toHaveLength(17);
    expect(graph.edges).toHaveLength(16);
    expect(graph.edges.every(e => e.op === '--')).toBe(true);
    expect(graph.groups).toHaveLength(3);
  });

  it('parses erd.g with zero errors', () => {
    const { graph, errors } = parseFile('erd.g');
    expect(errors).toEqual([]);
    expect(graph.direction).toBe('LR');
    expect(graph.nodes).toHaveLength(6);
    // All nodes should have multiline labels
    expect(graph.nodes.every(n => n.label?.includes('\n'))).toBe(true);
    expect(graph.edges).toHaveLength(7);
    expect(graph.groups).toHaveLength(3);
  });

  it('parses full-example.g with zero errors', () => {
    const { graph, errors } = parseFile('full-example.g');
    expect(errors).toEqual([]);
    expect(graph.direction).toBe('LR');
    expect(graph.nodes).toHaveLength(10);
    expect(graph.edges).toHaveLength(8);
    expect(graph.groups).toHaveLength(3);
    expect(graph.positions).toHaveLength(0);
    expect(graph.styles).toHaveLength(4);
  });

  it('parses how-llms-work.g with zero errors', () => {
    const { graph, errors } = parseFile('how-llms-work.g');
    expect(errors).toEqual([]);
    expect(graph.direction).toBe('TB');
    expect(graph.nodes.length).toBeGreaterThan(10);
    expect(graph.groups).toHaveLength(4);
    expect(graph.styles).toHaveLength(3);
  });

  it('parses glypho-explained.g with zero errors', () => {
    const { graph, errors } = parseFile('glypho-explained.g');
    expect(errors).toEqual([]);
    expect(graph.direction).toBe('TB');
    expect(graph.nodes.length).toBeGreaterThan(30);
    expect(graph.groups.length).toBeGreaterThan(5);
    expect(graph.styles.length).toBeGreaterThan(3);
  });

  it('parses cli.g with zero errors', () => {
    const { graph, errors } = parseFile('cli.g');
    expect(errors).toEqual([]);
    expect(graph.direction).toBe('TB');
    expect(graph.nodes.length).toBeGreaterThan(20);
    expect(graph.groups.length).toBeGreaterThan(5);
    expect(graph.styles.length).toBeGreaterThan(3);
  });
});
