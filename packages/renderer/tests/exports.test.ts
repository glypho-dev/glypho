import { describe, it, expect } from 'vitest';
import * as root from '../src/index.js';
import * as svg from '../src/svg.js';

describe('entry points', () => {
  it('the root entry exposes everything the svg entry does', () => {
    for (const name of Object.keys(svg)) {
      expect((root as Record<string, unknown>)[name], name).toBe((svg as Record<string, unknown>)[name]);
    }
  });

  it('the root entry exports render and renderSvg', () => {
    expect(root.render).toBeTypeOf('function');
    expect(root.renderSvg).toBeTypeOf('function');
    expect(root.render('a>b').svg).toContain('<svg');
  });
});
