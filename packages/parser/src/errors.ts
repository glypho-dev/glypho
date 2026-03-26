import type { ParseError } from './types.js';

export class GlyphoParseError extends Error {
  public readonly line: number;
  public readonly column?: number;

  constructor(message: string, line: number, column?: number) {
    super(`Line ${line}${column != null ? `:${column}` : ''}: ${message}`);
    this.name = 'GlyphoParseError';
    this.line = line;
    this.column = column;
  }

  toParseError(): ParseError {
    return { message: this.message, line: this.line, column: this.column };
  }
}
