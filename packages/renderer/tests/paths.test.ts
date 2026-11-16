import { describe, it, expect } from 'vitest';
import { pointsToPath, pathMidpoint, shortenEnd, shortenStart } from '../src/edges/paths.js';

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

describe('shortenEnd / shortenStart', () => {
  it('trims the last segment when it is long enough', () => {
    expect(shortenEnd([{ x: 0, y: 0 }, { x: 30, y: 0 }], 10)).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
    expect(shortenStart([{ x: 0, y: 0 }, { x: 30, y: 0 }], 10)).toEqual([{ x: 10, y: 0 }, { x: 30, y: 0 }]);
  });

  it('walks back over segments shorter than the arrowhead', () => {
    // Dense routes end in 8px segments; the arrow must still stop 10px short
    const pts = [0, 8, 16, 24, 32, 40].map(x => ({ x, y: 0 }));
    const end = shortenEnd(pts, 10);
    expect(end[end.length - 1]).toEqual({ x: 30, y: 0 });
    expect(end.every(p => p.x <= 30)).toBe(true);
    const start = shortenStart(pts, 10);
    expect(start[0]).toEqual({ x: 10, y: 0 });
    expect(start.every(p => p.x >= 10)).toBe(true);
  });

  it('leaves a path shorter than the trim alone', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }];
    expect(shortenEnd(pts, 10)).toEqual(pts);
  });
});
