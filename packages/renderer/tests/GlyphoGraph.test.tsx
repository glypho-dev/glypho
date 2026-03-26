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
});
