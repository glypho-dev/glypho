import { extname } from 'node:path';

export type InputFormat = 'glypho' | 'mermaid' | 'dot';

export function detectFormat(file: string): InputFormat {
  if (file === '-') return 'glypho';
  const ext = extname(file).toLowerCase();
  switch (ext) {
    case '.g': return 'glypho';
    case '.mmd': case '.mermaid': return 'mermaid';
    case '.dot': case '.gv': return 'dot';
    default: return 'glypho';
  }
}
