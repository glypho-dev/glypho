import type { Graph } from '@glypho/parser';
import { renderSvg as pureRenderSvg } from '@glypho/renderer/svg';

export interface RenderSvgOptions {
  width?: number;
  height?: number;
  padding?: number;
  background?: string;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderSvg(graph: Graph, options: RenderSvgOptions = {}): string {
  let svg = pureRenderSvg(graph, options);
  if (options.background) {
    const vbMatch = svg.match(/viewBox="([^"]+)"/);
    let bgRect: string;
    if (vbMatch) {
      const [x, y, w, h] = vbMatch[1].split(/\s+/);
      bgRect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escapeAttr(options.background)}"/>`;
    } else {
      bgRect = `<rect width="100%" height="100%" fill="${escapeAttr(options.background)}"/>`;
    }
    svg = svg.replace(/<svg([^>]*)>/, `<svg$1>${bgRect}`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}
