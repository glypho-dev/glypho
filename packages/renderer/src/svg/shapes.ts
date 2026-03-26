import type { Shape } from '@glypho/parser';
import type { NodeStyle } from '../styles/defaults.js';
import { escapeXml } from './escape.js';

export function renderShape(shape: Shape, width: number, height: number, style: NodeStyle): string {
  const fill = escapeXml(style.fill);
  const stroke = escapeXml(style.stroke);
  const sw = style.strokeWidth;

  switch (shape) {
    case 'r':
      return `<rect x="0" y="0" width="${width}" height="${height}" rx="4" ry="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'd': {
      const cx = width / 2;
      const cy = height / 2;
      return `<polygon points="${cx},0 ${width},${cy} ${cx},${height} 0,${cy}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }

    case 'c': {
      const r = Math.min(width, height) / 2;
      return `<circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }

    case 'o':
      return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'p':
      return `<rect x="0" y="0" width="${width}" height="${height}" rx="${height / 2}" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

    case 'h': {
      const inset = width * 0.2;
      const points = [
        `${inset},0`,
        `${width - inset},0`,
        `${width},${height / 2}`,
        `${width - inset},${height}`,
        `${inset},${height}`,
        `0,${height / 2}`,
      ].join(' ');
      return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }
  }
}
