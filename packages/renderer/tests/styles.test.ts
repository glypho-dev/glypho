import { describe, it, expect } from 'vitest';
import { resolveNodeStyle, resolveEdgeColor } from '../src/styles/resolve.js';
import type { Node, Style } from '@glypho/parser';

describe('resolveNodeStyle', () => {
  it('returns shape defaults for unstyled node', () => {
    const node: Node = { id: 'a', shape: 'r' };
    const style = resolveNodeStyle(node, []);
    expect(style.fill).toBe('#ffffff');
    expect(style.stroke).toBe('#222222');
    expect(style.strokeWidth).toBe(2);
  });

  it('returns diamond defaults', () => {
    const node: Node = { id: 'a', shape: 'd' };
    const style = resolveNodeStyle(node, []);
    expect(style.fill).toBe('#fff8e1');
    expect(style.stroke).toBe('#f9a825');
  });

  it('applies $:shape style rules', () => {
    const node: Node = { id: 'a', shape: 'r' };
    const styles: Style[] = [
      { selector: ':r', properties: { fill: '#ff0000', stroke: '#000' } },
    ];
    const style = resolveNodeStyle(node, styles);
    expect(style.fill).toBe('#ff0000');
    expect(style.stroke).toBe('#000000');
  });

  it('applies $#id style rules', () => {
    const node: Node = { id: 'mynode', shape: 'r' };
    const styles: Style[] = [
      { selector: '#mynode', properties: { fill: '#abcdef' } },
    ];
    const style = resolveNodeStyle(node, styles);
    expect(style.fill).toBe('#abcdef');
  });

  it('applies $.class style rules', () => {
    const node: Node = { id: 'a', shape: 'r', classes: ['highlight'] };
    const styles: Style[] = [
      { selector: '.highlight', properties: { fill: '#ff0', stroke: '#333' } },
    ];
    const style = resolveNodeStyle(node, styles);
    expect(style.fill).toBe('#ffff00');
    expect(style.stroke).toBe('#333333');
  });

  it('id styles override shape styles', () => {
    const node: Node = { id: 'a', shape: 'r' };
    const styles: Style[] = [
      { selector: ':r', properties: { fill: '#111111' } },
      { selector: '#a', properties: { fill: '#222222' } },
    ];
    const style = resolveNodeStyle(node, styles);
    expect(style.fill).toBe('#222222');
  });

  it('class styles override shape styles but not id styles', () => {
    const node: Node = { id: 'a', shape: 'r', classes: ['highlight'] };
    const styles: Style[] = [
      { selector: ':r', properties: { fill: '#111111' } },
      { selector: '.highlight', properties: { fill: '#222222' } },
      { selector: '#a', properties: { fill: '#333333' } },
    ];
    const style = resolveNodeStyle(node, styles);
    expect(style.fill).toBe('#333333');
  });

  it('inline color overrides everything', () => {
    const node: Node = { id: 'a', shape: 'r', color: '#f00' };
    const styles: Style[] = [
      { selector: '#a', properties: { fill: '#222222' } },
    ];
    const style = resolveNodeStyle(node, styles);
    expect(style.stroke).toBe('#ff0000');
    // Fill should be a light tint of red
    expect(style.fill).not.toBe('#222222');
  });

  it('defaults to rectangle when no shape specified', () => {
    const node: Node = { id: 'a' };
    const style = resolveNodeStyle(node, []);
    expect(style.fill).toBe('#ffffff');
    expect(style.stroke).toBe('#222222');
  });
});

describe('resolveEdgeColor', () => {
  it('returns default when no color', () => {
    expect(resolveEdgeColor()).toBe('#444444');
  });

  it('normalizes 3-digit hex', () => {
    expect(resolveEdgeColor('#f00')).toBe('#ff0000');
  });

  it('passes through 6-digit hex', () => {
    expect(resolveEdgeColor('#abcdef')).toBe('#abcdef');
  });
});
