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

  it('keeps non-members outside a group box even when the flow passes through', () => {
    // a>b>c with only a and c grouped: flat layout used to draw the group box
    // straight over b, misstating membership.
    const result = computeLayout(makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'a', to: 'b', op: '>' },
        { from: 'b', to: 'c', op: '>' },
      ],
      groups: [{ id: 'g', members: ['a', 'c'] }],
    }));

    const b = result.nodes.find(node => node.id === 'b')!;
    const group = result.groups[0];
    const bInsideGroup = b.x + b.width > group.x
      && b.x < group.x + group.width
      && b.y + b.height > group.y
      && b.y < group.y + group.height;
    expect(bInsideGroup).toBe(false);

    for (const id of ['a', 'c']) {
      const member = result.nodes.find(node => node.id === id)!;
      expect(member.x).toBeGreaterThanOrEqual(group.x);
      expect(member.y).toBeGreaterThanOrEqual(group.y);
      expect(member.x + member.width).toBeLessThanOrEqual(group.x + group.width);
      expect(member.y + member.height).toBeLessThanOrEqual(group.y + group.height);
    }
  });

  it('lays out sibling groups as disjoint clusters', () => {
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

    const grouped = computeLayout({
      ...baseGraph,
      groups: [
        { id: 'auth', members: ['login', 'validate', 'mfa', 'verify', 'mfa_check'] },
        { id: 'outcomes', members: ['dashboard', 'retry', 'lockout'] },
      ],
    });

    const auth = grouped.groups.find(group => group.group.id === 'auth')!;
    const outcomes = grouped.groups.find(group => group.group.id === 'outcomes')!;
    const overlap = !(
      auth.x + auth.width <= outcomes.x
      || outcomes.x + outcomes.width <= auth.x
      || auth.y + auth.height <= outcomes.y
      || outcomes.y + outcomes.height <= auth.y
    );
    expect(overlap).toBe(false);

    // Every member sits inside its own group's rectangle.
    const membership: Array<[typeof auth, string[]]> = [
      [auth, ['login', 'validate', 'mfa', 'verify', 'mfa_check']],
      [outcomes, ['dashboard', 'retry', 'lockout']],
    ];
    for (const [group, members] of membership) {
      for (const id of members) {
        const member = grouped.nodes.find(node => node.id === id)!;
        expect(member.x).toBeGreaterThanOrEqual(group.x);
        expect(member.y).toBeGreaterThanOrEqual(group.y);
        expect(member.x + member.width).toBeLessThanOrEqual(group.x + group.width);
        expect(member.y + member.height).toBeLessThanOrEqual(group.y + group.height);
      }
    }
  });

  it('keeps adjacent group boxes close despite cluster border ranks', () => {
    // Layered TB architecture: one group per rank. Compound layout inserts
    // empty border ranks; the compression pass must squash them so stacked
    // group boxes stay near each other instead of drifting apart.
    const result = computeLayout(makeGraph({
      direction: 'TB',
      nodes: [
        { id: 'ui' }, { id: 'api' }, { id: 'db' },
      ],
      edges: [
        { from: 'ui', to: 'api', op: '>' },
        { from: 'api', to: 'db', op: '>' },
      ],
      groups: [
        { id: 'front', members: ['ui'] },
        { id: 'back', members: ['api'] },
        { id: 'data', members: ['db'] },
      ],
    }));

    const front = result.groups.find(group => group.group.id === 'front')!;
    const back = result.groups.find(group => group.group.id === 'back')!;
    const data = result.groups.find(group => group.group.id === 'data')!;

    const gap1 = back.y - (front.y + front.height);
    const gap2 = data.y - (back.y + back.height);
    expect(gap1).toBeGreaterThanOrEqual(0);
    expect(gap2).toBeGreaterThanOrEqual(0);
    expect(gap1).toBeLessThanOrEqual(48);
    expect(gap2).toBeLessThanOrEqual(48);
  });

  it('lays out the cli example with disjoint top-level groups', () => {
    const examplePath = resolve(process.cwd(), '../../spec/examples/cli.g');
    const source = readFileSync(examplePath, 'utf8');
    const { graph } = parse(source);
    const result = computeLayout(graph);

    const topLevel = result.groups.filter(group => group.depth === 0);
    expect(topLevel.length).toBeGreaterThan(1);

    for (let i = 0; i < topLevel.length; i++) {
      for (let j = i + 1; j < topLevel.length; j++) {
        const a = topLevel[i];
        const b = topLevel[j];
        const overlap = !(
          a.x + a.width <= b.x
          || b.x + b.width <= a.x
          || a.y + a.height <= b.y
          || b.y + b.height <= a.y
        );
        expect(overlap, `groups ${a.group.id} and ${b.group.id} overlap`).toBe(false);
      }
    }

    // Members stay inside their group rectangles.
    for (const layoutGroup of result.groups) {
      for (const id of layoutGroup.group.members) {
        const member = result.nodes.find(node => node.id === id);
        if (!member) continue;
        expect(member.x).toBeGreaterThanOrEqual(layoutGroup.x);
        expect(member.y).toBeGreaterThanOrEqual(layoutGroup.y);
        expect(member.x + member.width).toBeLessThanOrEqual(layoutGroup.x + layoutGroup.width);
        expect(member.y + member.height).toBeLessThanOrEqual(layoutGroup.y + layoutGroup.height);
      }
    }
  });
});
