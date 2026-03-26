import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { computeLayout } from '../src/layout/layout.js';
import { parse } from '@glypho/parser';
import type { Graph } from '@glypho/parser';

function makeGraph(overrides: Partial<Graph> = {}): Graph {
  return {
    nodes: [],
    edges: [],
    groups: [],
    positions: [],
    styles: [],
    ...overrides,
  };
}

describe('computeLayout', () => {
  it('handles empty graph', () => {
    const result = computeLayout(makeGraph());
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.groups).toEqual([]);
  });

  it('lays out a single node', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }],
    }));
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('a');
    expect(typeof result.nodes[0].x).toBe('number');
    expect(typeof result.nodes[0].y).toBe('number');
    expect(result.nodes[0].width).toBeGreaterThan(0);
    expect(result.nodes[0].height).toBeGreaterThan(0);
  });

  it('lays out two connected nodes', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    }));
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it('respects explicit positions', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      positions: [{ id: 'a', x: 100, y: 200 }],
    }));
    const nodeA = result.nodes.find(n => n.id === 'a')!;
    expect(nodeA.x).toBe(100);
    expect(nodeA.y).toBe(200);
  });

  it('creates group bounding boxes', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
      groups: [{ id: 'g1', members: ['a', 'b'] }],
    }));
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].width).toBeGreaterThan(0);
    expect(result.groups[0].height).toBeGreaterThan(0);
  });

  it('uses direction from graph', () => {
    const lr = computeLayout(makeGraph({
      direction: 'LR',
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    }));
    const nodeA = lr.nodes.find(n => n.id === 'a')!;
    const nodeB = lr.nodes.find(n => n.id === 'b')!;
    // In LR mode, b should be to the right of a
    expect(nodeB.x).toBeGreaterThan(nodeA.x);
  });

  it('creates nested group bounding boxes with correct depth', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
      groups: [{
        id: 'outer', members: ['c'],
        children: [{ id: 'inner', members: ['a', 'b'] }],
      }],
    }));
    expect(result.groups).toHaveLength(2);
    const outer = result.groups.find(g => g.group.id === 'outer')!;
    const inner = result.groups.find(g => g.group.id === 'inner')!;
    expect(outer.depth).toBe(0);
    expect(inner.depth).toBe(1);
    // Outer should contain inner
    expect(outer.x).toBeLessThanOrEqual(inner.x);
    expect(outer.y).toBeLessThanOrEqual(inner.y);
    expect(outer.x + outer.width).toBeGreaterThanOrEqual(inner.x + inner.width);
    expect(outer.y + outer.height).toBeGreaterThanOrEqual(inner.y + inner.height);
  });

  it('sorts groups by depth (outermost first)', () => {
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }],
      groups: [{
        id: 'outer', members: [],
        children: [{ id: 'inner', members: ['a'] }],
      }],
    }));
    expect(result.groups[0].group.id).toBe('outer');
    expect(result.groups[1].group.id).toBe('inner');
  });

  it('does not change connected node positions just because groups are present', () => {
    const baseGraph = makeGraph({
      direction: 'TB',
      nodes: [
        { id: 'start', shape: 'c', label: 'Start' },
        { id: 'login', shape: 'r', label: 'Enter Credentials' },
        { id: 'validate', shape: 'd', label: 'Valid?' },
        { id: 'mfa', shape: 'd', label: 'MFA Enabled?' },
        { id: 'verify', shape: 'r', label: 'Enter MFA Code' },
        { id: 'mfa_check', shape: 'd', label: 'Code Valid?' },
        { id: 'dashboard', shape: 'r', label: 'Dashboard' },
        { id: 'retry', shape: 'r', label: 'Show Error' },
        { id: 'lockout', shape: 'r', label: 'Account Locked' },
      ],
      edges: [
        { from: 'start', to: 'login', op: '>' },
        { from: 'login', to: 'validate', op: '>' },
        { from: 'validate', to: 'mfa', op: '>', label: 'yes' },
        { from: 'validate', to: 'retry', op: '>', label: 'no' },
        { from: 'mfa', to: 'dashboard', op: '>', label: 'no' },
        { from: 'mfa', to: 'verify', op: '>', label: 'yes' },
        { from: 'verify', to: 'mfa_check', op: '>' },
        { from: 'mfa_check', to: 'dashboard', op: '>', label: 'yes' },
        { from: 'mfa_check', to: 'retry', op: '>', label: 'no' },
        { from: 'retry', to: 'login', op: '>', label: 'retry' },
      ],
    });

    const ungrouped = computeLayout(baseGraph);
    const grouped = computeLayout({
      ...baseGraph,
      groups: [
        { id: 'auth', members: ['login', 'validate', 'mfa', 'verify', 'mfa_check'] },
        { id: 'outcomes', members: ['dashboard', 'retry', 'lockout'] },
      ],
    });

    for (const nodeId of ['start', 'login', 'validate', 'mfa', 'verify', 'mfa_check', 'dashboard', 'retry']) {
      const plain = ungrouped.nodes.find(node => node.id === nodeId)!;
      const withGroups = grouped.nodes.find(node => node.id === nodeId)!;
      expect(withGroups.x).toBe(plain.x);
      expect(withGroups.y).toBe(plain.y);
    }
  });

  it('keeps wide terminal groups compact in the cli example', () => {
    const examplePath = resolve(process.cwd(), '../../spec/examples/cli.g');
    const source = readFileSync(examplePath, 'utf8');
    const { graph } = parse(source);
    const result = computeLayout(graph);

    const convertGroup = result.groups.find(group => group.group.id === 'convert');
    const renderingGroup = result.groups.find(group => group.group.id === 'rendering');
    const mermaidText = result.nodes.find(node => node.id === 'mermaid_text');
    const gText = result.nodes.find(node => node.id === 'g_text');
    const svgOut = result.nodes.find(node => node.id === 'svg_out');

    expect(convertGroup).toBeDefined();
    expect(renderingGroup).toBeDefined();
    expect(mermaidText).toBeDefined();
    expect(gText).toBeDefined();
    expect(svgOut).toBeDefined();
    expect(convertGroup!.width).toBeLessThan(500);
    expect(gText!.x - (mermaidText!.x + mermaidText!.width)).toBe(60);
    expect(gText!.y).toBe(mermaidText!.y);
    expect(convertGroup!.y).toBeGreaterThanOrEqual(renderingGroup!.y + renderingGroup!.height);
    expect(gText!.y).toBeGreaterThan(svgOut!.y + svgOut!.height);
  });
});
