import { Resvg } from '@resvg/resvg-js';

export interface RenderPngOptions {
  scale?: number;
  background?: string;
}

const MIN_DIMENSION = 4096;
const MIN_SCALE = 2;
const MAX_SCALE = 8;

/**
 * Extract the intrinsic dimensions from an SVG string.
 * Checks width/height attributes first, then falls back to viewBox.
 */
function intrinsicSize(svg: string): { width: number; height: number } | null {
  const widthMatch = svg.match(/<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"/);
  const heightMatch = svg.match(/<svg[^>]*\bheight="(\d+(?:\.\d+)?)"/);
  if (widthMatch && heightMatch) {
    return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) };
  }
  const vbMatch = svg.match(/<svg[^>]*\bviewBox="[^"]*\s([\d.]+)\s([\d.]+)"/);
  if (vbMatch) {
    return { width: parseFloat(vbMatch[1]), height: parseFloat(vbMatch[2]) };
  }
  return null;
}

/**
 * Compute a zoom scale that ensures the longest side of the output PNG
 * is at least MIN_DIMENSION pixels. Clamped between MIN_SCALE and MAX_SCALE.
 */
function autoScale(svg: string): number {
  const size = intrinsicSize(svg);
  if (!size) return MIN_SCALE;
  const longest = Math.max(size.width, size.height);
  if (longest <= 0) return MIN_SCALE;
  const needed = MIN_DIMENSION / longest;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.ceil(needed)));
}

export function renderPng(svg: string, options: RenderPngOptions = {}): Buffer {
  const scale = options.scale ?? autoScale(svg);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom' as const, value: scale },
    background: options.background,
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
