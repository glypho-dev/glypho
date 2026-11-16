import { Resvg } from '@resvg/resvg-js';
import { CliError } from './errors.js';

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

const PROBE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

/**
 * Check that resvg accepts a background color before rendering, so a typo
 * gives a clean error instead of resvg's opaque "invalid value" failure.
 * resvg supports hex, rgb()/rgba(), hsl()/hsla(), transparent and the basic
 * CSS color names.
 */
export function validatePngBackground(background: string): void {
  try {
    new Resvg(PROBE_SVG, { background }).render();
  } catch {
    throw new CliError(
      `invalid --background color '${background}' for PNG output (use a hex value like #fff, rgb()/hsl(), a basic color name, or transparent)`,
    );
  }
}

export function renderPng(svg: string, options: RenderPngOptions = {}): Buffer {
  if (options.scale !== undefined && !(Number.isFinite(options.scale) && options.scale > 0)) {
    throw new CliError(`invalid --scale ${options.scale}; expected a positive number`);
  }
  if (options.background !== undefined) validatePngBackground(options.background);
  const scale = options.scale ?? autoScale(svg);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom' as const, value: scale },
    background: options.background,
    // The SVG uses font-family="system-ui, sans-serif". System fonts must be
    // loaded so resvg can resolve the generic sans-serif family and fall back
    // per-glyph for scripts it doesn't cover (e.g. CJK). Known limitation:
    // emoji render as tofu — resvg has no color-font (sbix/COLR) support, and
    // a single emoji currently breaks the whole text run in resvg 2.6.
    font: {
      loadSystemFonts: true,
    },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
