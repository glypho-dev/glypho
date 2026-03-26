import { Resvg } from '@resvg/resvg-js';

export interface RenderPngOptions {
  scale?: number;
}

export function renderPng(svg: string, options: RenderPngOptions = {}): Buffer {
  const scale = options.scale ?? 2;
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom' as const, value: scale },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
