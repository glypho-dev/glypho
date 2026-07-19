import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, flattenGroups, type Graph, type Group } from '@glypho/parser';
import { renderSvg } from '../src/svg/render-svg.js';
import { computeLayout } from '../src/layout/layout.js';
import type { LayoutGroup, LayoutNode } from '../src/layout/types.js';

const EXAMPLES_DIR = resolve(import.meta.dirname, '../../../spec/examples');
const EXAMPLES = readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.g')).sort();

// glypho-explained.g mixes pinned `id@x,y` nodes with auto layout; dagre cannot
// see pinned coordinates, so overlaps are inherent there (the published
// renderer fails it too). Snapshots still cover it; invariants skip it.
const LAYOUT_KNOWN_ISSUES = new Set(['glypho-explained.g']);

function loadGraph(name: string): Graph {
  const source = readFileSync(resolve(EXAMPLES_DIR, name), 'utf-8');
  const { graph, errors } = parse(source);
  expect(errors).toEqual([]);
  return graph;
}

interface Rect { x: number; y: number; width: number; height: number }

function overlaps(a: Rect, b: Rect, tolerance = 1): boolean {
  return a.x + tolerance < b.x + b.width
    && b.x + tolerance < a.x + a.width
    && a.y + tolerance < b.y + b.height
    && b.y + tolerance < a.y + a.height;
}

function contains(outer: Rect, inner: Rect, tolerance = 1): boolean {
  return inner.x >= outer.x - tolerance
    && inner.y >= outer.y - tolerance
    && inner.x + inner.width <= outer.x + outer.width + tolerance
    && inner.y + inner.height <= outer.y + outer.height + tolerance;
}

/** All member ids of a group including nested children's members */
function memberSet(group: Group): Set<string> {
  const ids = new Set(group.members);
  for (const child of group.children ?? []) {
    for (const id of memberSet(child)) ids.add(id);
  }
  return ids;
}

/** Sibling group sets: top-level groups, plus each group's children */
function siblingSets(groups: Group[]): Group[][] {
  const sets: Group[][] = [groups];
  for (const g of flattenGroups(groups)) {
    if (g.children && g.children.length > 1) sets.push(g.children);
  }
  return sets;
}

describe('SVG snapshots of spec examples', () => {
  for (const name of EXAMPLES) {
    it(name, async () => {
      const svg = renderSvg(loadGraph(name));
      await expect(svg).toMatchFileSnapshot(`__snapshots__/examples/${name}.svg`);
    });
  }
});

describe('layout invariants on spec examples', () => {
  for (const name of EXAMPLES) {
    if (LAYOUT_KNOWN_ISSUES.has(name)) continue;
    const graph = loadGraph(name);
    const layout = computeLayout(graph);
    const nodeById = new Map<string, LayoutNode>(layout.nodes.map(n => [n.id, n]));
    const groupById = new Map<string, LayoutGroup>(layout.groups.map(g => [g.group.id, g]));

    it(`${name}: no node-node overlaps`, () => {
      const bad: string[] = [];
      for (let i = 0; i < layout.nodes.length; i++) {
        for (let j = i + 1; j < layout.nodes.length; j++) {
          if (overlaps(layout.nodes[i], layout.nodes[j])) {
            bad.push(`${layout.nodes[i].id} <-> ${layout.nodes[j].id}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });

    it(`${name}: members lie inside their group box`, () => {
      const bad: string[] = [];
      for (const lg of layout.groups) {
        for (const id of memberSet(lg.group)) {
          const node = nodeById.get(id);
          if (node && !contains(lg, node)) {
            bad.push(`${id} outside ${lg.group.id}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });

    it(`${name}: sibling group boxes are disjoint`, () => {
      const bad: string[] = [];
      for (const siblings of siblingSets(graph.groups)) {
        for (let i = 0; i < siblings.length; i++) {
          for (let j = i + 1; j < siblings.length; j++) {
            const a = siblings[i];
            const b = siblings[j];
            // Overlapping member sets must draw overlapping boxes — skip those
            const shared = [...memberSet(a)].some(id => memberSet(b).has(id));
            if (shared) continue;
            const la = groupById.get(a.id);
            const lb = groupById.get(b.id);
            if (la && lb && overlaps(la, lb)) {
              bad.push(`${a.id} <-> ${b.id}`);
            }
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
