import type { Graph } from '@glypho/parser';
import { renderSvg as pureRenderSvg } from '@glypho/renderer/svg';

export interface RenderSvgOptions {
  width?: number;
  height?: number;
  padding?: number;
}

export function renderSvg(graph: Graph, options: RenderSvgOptions = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${pureRenderSvg(graph, options)}`;
}
