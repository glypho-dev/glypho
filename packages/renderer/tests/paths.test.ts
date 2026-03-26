import { describe, it, expect } from 'vitest';
import { pointsToPath, pathMidpoint } from '../src/edges/paths.js';

describe('pointsToPath', () => {
  it('returns empty for less than 2 points', () => {
    expect(pointsToPath([])).toBe('');
    expect(pointsToPath([{ x: 0, y: 0 }])).toBe('');
  });

  it('creates straight line for 2 points', () => {
    const d = pointsToPath([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
    expect(d).toBe('M 0 0 L 100 50');
  });

  it('creates curved path for 3+ points', () => {
    const d = pointsToPath([
      { x: 0, y: 0 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ]);
    expect(d).toContain('M 0 0');
    expect(d).toContain('Q');
    expect(d).toContain('100 0');
  });
});

describe('pathMidpoint', () => {
  it('returns origin for empty', () => {
    expect(pathMidpoint([])).toEqual({ x: 0, y: 0 });
  });

  it('returns point for single', () => {
    expect(pathMidpoint([{ x: 10, y: 20 }])).toEqual({ x: 10, y: 20 });
  });

  it('returns midpoint for 2 points', () => {
    const mid = pathMidpoint([{ x: 0, y: 0 }, { x: 100, y: 100 }]);
    expect(mid).toEqual({ x: 50, y: 50 });
  });

  it('returns middle point for odd count', () => {
    const mid = pathMidpoint([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    expect(mid).toEqual({ x: 50, y: 50 });
  });
});
