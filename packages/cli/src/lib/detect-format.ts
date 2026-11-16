import { extname } from 'node:path';
import { CliError } from './errors.js';

export type InputFormat = 'glypho' | 'mermaid' | 'dot';

export const FROM_HELP = 'Input format: g, mermaid, or dot (default: from file extension; .g for stdin)';

const FROM_ALIASES: Record<string, InputFormat> = {
  g: 'glypho',
  glypho: 'glypho',
  mermaid: 'mermaid',
  mmd: 'mermaid',
  dot: 'dot',
  gv: 'dot',
};

/** Parse a `--from` value. */
export function parseInputFormat(value: string): InputFormat {
  const format = FROM_ALIASES[value.toLowerCase()];
  if (!format) {
    throw new CliError(`invalid --from '${value}' (valid values: g, mermaid, dot)`);
  }
  return format;
}

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
