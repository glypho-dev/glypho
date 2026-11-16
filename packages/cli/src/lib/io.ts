import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { CliError } from './errors.js';

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readInput(fileOrDash: string): string {
  let input: string;
  if (fileOrDash === '-') {
    try {
      input = readFileSync(0, 'utf-8'); // stdin fd=0
    } catch (error) {
      throw new CliError(`failed to read stdin: ${errorMessage(error)}`);
    }
  } else {
    let isDirectory = false;
    try {
      isDirectory = statSync(fileOrDash).isDirectory();
    } catch (error) {
      if (errorCode(error) === 'ENOENT') throw new CliError(`file not found: ${fileOrDash}`);
      throw new CliError(`cannot read ${fileOrDash}: ${errorMessage(error)}`);
    }
    if (isDirectory) throw new CliError(`${fileOrDash} is a directory, not a file`);
    try {
      input = readFileSync(fileOrDash, 'utf-8');
    } catch (error) {
      throw new CliError(`cannot read ${fileOrDash}: ${errorMessage(error)}`);
    }
  }

  if (input.trim().length === 0) {
    throw new CliError(`${formatInputName(fileOrDash)} is empty; nothing to read`);
  }
  return input;
}

export function resolveInputFile(file?: string): string {
  if (file && file.length > 0) return file;
  if (process.stdin.isTTY) {
    throw new CliError('missing input; pass <file>, use -, or pipe data to stdin');
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

function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/**
 * Write a rendered file, creating missing parent directories. Refuses to
 * overwrite the input file and turns filesystem failures into CliErrors.
 */
export function writeOutput(outPath: string, data: string | Buffer, inputFile: string): void {
  if (inputFile !== '-' && canonicalPath(outPath) === canonicalPath(inputFile)) {
    throw new CliError(`refusing to overwrite the input file ${inputFile}; pass a different --output path`);
  }
  try {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(outPath, data);
  } catch (error) {
    const code = errorCode(error);
    if (code === 'EISDIR') throw new CliError(`cannot write ${outPath}: it is a directory`);
    if (code === 'EEXIST' || code === 'ENOTDIR') {
      throw new CliError(`cannot write ${outPath}: a parent path exists and is not a directory`);
    }
    throw new CliError(`cannot write ${outPath}: ${errorMessage(error)}`);
  }
}
