import { readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

export function readInput(fileOrDash: string): string {
  if (fileOrDash === '-') {
    return readFileSync(0, 'utf-8');  // stdin fd=0
  }
  return readFileSync(fileOrDash, 'utf-8');
}

export function resolveInputFile(file?: string): string {
  if (file && file.length > 0) return file;
  if (process.stdin.isTTY) {
    console.error('error: missing input; pass <file>, use -, or pipe data to stdin');
    process.exit(1);
  }
  return '-';
}

export function formatInputName(fileOrDash: string): string {
  return fileOrDash === '-' ? '<stdin>' : fileOrDash;
}

export function deriveOutputPath(inputFile: string, newExt: string): string {
  if (inputFile === '-') return `output${newExt}`;
  const dir = dirname(inputFile);
  const name = basename(inputFile, extname(inputFile));
  return join(dir, `${name}${newExt}`);
}
