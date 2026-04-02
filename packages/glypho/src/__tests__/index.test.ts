import { describe, it, expect } from 'vitest';

describe('glypho (default entry)', () => {
  it('exports parser functions', async () => {
    const mod = await import('../index.js');
    expect(mod.parse).toBeTypeOf('function');
    expect(mod.parseMermaid).toBeTypeOf('function');
    expect(mod.parseDot).toBeTypeOf('function');
    expect(mod.graphToMermaid).toBeTypeOf('function');
    expect(mod.graphToGlypho).toBeTypeOf('function');
    expect(mod.graphToDot).toBeTypeOf('function');
    expect(mod.graphToJsonCanvas).toBeTypeOf('function');
    expect(mod.flattenGroups).toBeTypeOf('function');
    expect(mod.Lexer).toBeTypeOf('function');
    expect(mod.Parser).toBeTypeOf('function');
  });

  it('exports renderer functions', async () => {
    const mod = await import('../index.js');
    expect(mod.render).toBeTypeOf('function');
    expect(mod.renderSvg).toBeTypeOf('function');
    expect(mod.computeLayout).toBeTypeOf('function');
    expect(mod.measureNode).toBeTypeOf('function');
    expect(mod.measureText).toBeTypeOf('function');
    expect(mod.resolveNodeStyle).toBeTypeOf('function');
    expect(mod.resolveEdgeColor).toBeTypeOf('function');
  });

  it('does NOT export GlyphoGraph (React component)', async () => {
    const mod = await import('../index.js');
    expect((mod as Record<string, unknown>).GlyphoGraph).toBeUndefined();
  });

  it('parse → render round-trip produces SVG', async () => {
    const { parse, render } = await import('../index.js');
    const result = render('a > b');
    expect(result.svg).toContain('<svg');
    expect(result.errors).toHaveLength(0);

    const parseResult = parse('a > b');
    expect(parseResult.graph.nodes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('glypho/react entry', () => {
  it('exports GlyphoGraph component', async () => {
    const mod = await import('../react.js');
    expect(mod.GlyphoGraph).toBeTypeOf('function');
  });

  it('also exports parser and renderer functions', async () => {
    const mod = await import('../react.js');
    expect(mod.parse).toBeTypeOf('function');
    expect(mod.render).toBeTypeOf('function');
    expect(mod.renderSvg).toBeTypeOf('function');
  });
});
