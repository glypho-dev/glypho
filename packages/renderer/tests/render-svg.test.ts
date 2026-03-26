import { describe, it, expect } from 'vitest';
import { renderSvg, render } from '../src/svg/render-svg.js';
import type { Graph } from '@glypho/parser';

function emptyGraph(overrides: Partial<Graph> = {}): Graph {
  return {
    nodes: [],
    edges: [],
    groups: [],
    positions: [],
    styles: [],
    ...overrides,
  };
}

describe('renderSvg', () => {
  it('returns valid SVG for an empty graph', () => {
    const svg = renderSvg(emptyGraph());
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<defs>');
    expect(svg).toContain('</svg>');
  });

  it('renders a single node', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a', label: 'Hello' }],
    }));
    expect(svg).toContain('data-node-id="a"');
    expect(svg).toContain('>Hello</text>');
    expect(svg).toContain('<rect');
  });

  it('renders two nodes with an edge', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
    }));
    expect(svg).toContain('data-node-id="a"');
    expect(svg).toContain('data-node-id="b"');
    expect(svg).toContain('<path');
    expect(svg).toContain('marker-end="url(#arrowhead)"');
  });

  it('renders all shape types', () => {
    const shapes = ['r', 'd', 'c', 'o', 'p', 'h'] as const;
    for (const shape of shapes) {
      const svg = renderSvg(emptyGraph({
        nodes: [{ id: 's', label: 'S', shape }],
      }));
      expect(svg).toContain('data-node-id="s"');
    }

    // rect
    const rectSvg = renderSvg(emptyGraph({ nodes: [{ id: 'n', shape: 'r' }] }));
    expect(rectSvg).toContain('<rect');

    // diamond
    const diamondSvg = renderSvg(emptyGraph({ nodes: [{ id: 'n', shape: 'd' }] }));
    expect(diamondSvg).toContain('<polygon');

    // circle
    const circleSvg = renderSvg(emptyGraph({ nodes: [{ id: 'n', shape: 'c' }] }));
    expect(circleSvg).toContain('<circle');

    // oval
    const ovalSvg = renderSvg(emptyGraph({ nodes: [{ id: 'n', shape: 'o' }] }));
    expect(ovalSvg).toContain('<ellipse');

    // pill
    const pillSvg = renderSvg(emptyGraph({ nodes: [{ id: 'n', shape: 'p' }] }));
    expect(pillSvg).toMatch(/rx="\d+(\.\d+)?"/); // rounded corners

    // hexagon
    const hexSvg = renderSvg(emptyGraph({ nodes: [{ id: 'n', shape: 'h' }] }));
    expect(hexSvg).toContain('<polygon');
  });

  it('renders edge labels', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>', label: 'yes' }],
    }));
    expect(svg).toContain('>yes</text>');
  });

  it('renders groups', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      groups: [{ id: 'g1', label: 'My Group', members: ['a', 'b'] }],
    }));
    expect(svg).toContain('stroke-dasharray="6 3"');
    expect(svg).toContain('>My Group</text>');
  });

  it('renders different edge types', () => {
    const ops = ['>', '~', '=', '--', '<>'] as const;
    for (const op of ops) {
      const svg = renderSvg(emptyGraph({
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ from: 'a', to: 'b', op }],
      }));
      expect(svg).toContain('<path');
    }

    // dashed
    const dashed = renderSvg(emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '~' }],
    }));
    expect(dashed).toContain('stroke-dasharray="6 4"');

    // thick
    const thick = renderSvg(emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '=' }],
    }));
    expect(thick).toContain('stroke-width="4"');

    // bidirectional
    const bidi = renderSvg(emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '<>' }],
    }));
    expect(bidi).toContain('marker-start="url(#arrowhead-reverse)"');
    expect(bidi).toContain('marker-end="url(#arrowhead)"');
  });

  it('applies width and height options', () => {
    const svg = renderSvg(emptyGraph(), { width: 800, height: 600 });
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
  });

  it('omits width/height when not provided', () => {
    const svg = renderSvg(emptyGraph());
    expect(svg).not.toMatch(/width="\d+"/);
    expect(svg).not.toMatch(/height="\d+"/);
  });

  it('applies custom node colors', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a', label: 'A', color: '#ff0000' }],
    }));
    expect(svg).toContain('#ff0000');
  });

  it('escapes XML special characters in labels', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a', label: 'A < B & C > D' }],
    }));
    expect(svg).toContain('A &lt; B &amp; C &gt; D');
    expect(svg).not.toContain('A < B');
  });

  it('renders multi-line labels', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a', label: 'Line 1\nLine 2' }],
    }));
    const textMatches = svg.match(/<text[^>]*>[^<]*<\/text>/g) ?? [];
    const nodeTexts = textMatches.filter(t => t.includes('Line'));
    expect(nodeTexts).toHaveLength(2);
  });

  it('applies style rules', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a', shape: 'r' }],
      styles: [{ selector: ':r', properties: { fill: '#abc123' } }],
    }));
    expect(svg).toContain('#abc123');
  });

  it('escapes hostile style values in attributes', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a', shape: 'r' }],
      styles: [{ selector: ':r', properties: { fill: '"><script>alert(1)</script>' } }],
    }));
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('escapes hostile edge color values', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', op: '>', color: '"><svg onload=alert(1)>' }],
    }));
    // The quotes and angle brackets must be escaped so the attribute
    // boundary can't be broken — the hostile string stays inside the
    // stroke="..." value as inert text.
    expect(svg).toContain('&quot;');
    expect(svg).toContain('&gt;');
    // Must not contain an unescaped attribute-breaking sequence
    expect(svg).not.toContain('stroke=""');
  });
});

describe('render', () => {
  it('parses .g source and returns SVG', () => {
    const result = render('a "Hello"\nb "World"\na > b');
    expect(result.errors).toHaveLength(0);
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('>Hello</text>');
    expect(result.svg).toContain('>World</text>');
  });

  it('returns parse errors for invalid input', () => {
    const result = render('>>> invalid garbage <<<');
    expect(result.svg).toContain('<svg');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('passes options through', () => {
    const result = render('a "Test"', { width: 500 });
    expect(result.svg).toContain('width="500"');
  });

  it('renders nested groups as separate rectangles', () => {
    const svg = renderSvg(emptyGraph({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [{ from: 'a', to: 'b', op: '>' }],
      groups: [{
        id: 'outer', label: 'Outer', members: ['c'],
        children: [{ id: 'inner', label: 'Inner', members: ['a', 'b'] }],
      }],
    }));
    // Both group labels should appear
    expect(svg).toContain('Outer');
    expect(svg).toContain('Inner');
    // Outer group should have full opacity, inner should have reduced opacity
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).toContain('fill-opacity="0.85"');
  });
});
