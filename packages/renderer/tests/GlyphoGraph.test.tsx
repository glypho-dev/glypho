import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GlyphoGraph } from '../src/GlyphoGraph.js';
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

describe('GlyphoGraph', () => {
  it('renders an SVG element', () => {
    const { container } = render(<GlyphoGraph graph={makeGraph()} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('renders nodes', () => {
    const graph = makeGraph({
      nodes: [{ id: 'a', label: 'Hello' }, { id: 'b', label: 'World' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    });
    const { container } = render(<GlyphoGraph graph={graph} />);
    const nodeGroups = container.querySelectorAll('[data-node-id]');
    expect(nodeGroups).toHaveLength(2);
  });

  it('renders edge paths', () => {
    const graph = makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    });
    const { container } = render(<GlyphoGraph graph={graph} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('renders all shapes', () => {
    const shapes = ['r', 'd', 'c', 'o', 'p', 'h'] as const;
    const graph = makeGraph({
      nodes: shapes.map((s, i) => ({ id: `n${i}`, shape: s, label: s })),
    });
    const { container } = render(<GlyphoGraph graph={graph} />);
    const nodeGroups = container.querySelectorAll('[data-node-id]');
    expect(nodeGroups).toHaveLength(6);
  });

  it('renders groups', () => {
    const graph = makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      groups: [{ id: 'g1', label: 'My Group', members: ['a', 'b'] }],
    });
    const { container } = render(<GlyphoGraph graph={graph} />);
    // Group should create a dashed rect
    const rects = container.querySelectorAll('rect[stroke-dasharray]');
    expect(rects.length).toBeGreaterThanOrEqual(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <GlyphoGraph graph={makeGraph()} className="my-graph" />
    );
    const svg = container.querySelector('svg.my-graph');
    expect(svg).not.toBeNull();
  });

  it('renders edge labels', () => {
    const graph = makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>', label: 'yes' }],
    });
    const { container } = render(<GlyphoGraph graph={graph} />);
    expect(container.textContent).toContain('yes');
  });

  it('handles node click callback', () => {
    const clicks: string[] = [];
    const graph = makeGraph({
      nodes: [{ id: 'a', label: 'Click Me' }],
    });
    const { container } = render(
      <GlyphoGraph graph={graph} onNodeClick={(id) => clicks.push(id)} />
    );
    const node = container.querySelector('[data-node-id="a"]');
    node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks).toEqual(['a']);
  });

  it('gives each instance its own marker IDs', () => {
    const graph = makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    });
    const { container } = render(
      <>
        <GlyphoGraph graph={graph} />
        <GlyphoGraph graph={graph} />
      </>
    );
    const svgs = Array.from(container.querySelectorAll('svg'));
    expect(svgs).toHaveLength(2);
    const ids = svgs.map(svg => Array.from(svg.querySelectorAll('marker')).map(m => m.id));
    for (const id of ids[1]) expect(ids[0]).not.toContain(id);
    for (const [i, svg] of svgs.entries()) {
      for (const id of ids[i]) expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
      const ref = svg.querySelector('path')!.getAttribute('marker-end')!;
      expect(ids[i]).toContain(ref.slice('url(#'.length, -1));
    }
  });

  it('renders every group when group names repeat', () => {
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(args); };
    try {
      const graph = makeGraph({
        nodes: [{ id: 'a' }, { id: 'b' }],
        groups: [
          { id: 'dup', members: ['a'] },
          { id: 'dup', members: ['b'] },
        ],
      });
      const { container } = render(<GlyphoGraph graph={graph} />);
      expect(container.querySelectorAll('rect[stroke-dasharray]')).toHaveLength(2);
    } finally {
      console.error = original;
    }
    // React warns about duplicate keys through console.error
    expect(errors.filter(e => String(e).includes('same key'))).toEqual([]);
  });

  it('renders multi-line edge labels as separate lines', () => {
    const graph = makeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>', label: 'one\ntwo' }],
    });
    const { container } = render(<GlyphoGraph graph={graph} />);
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent);
    expect(texts).toContain('one');
    expect(texts).toContain('two');
  });
});
