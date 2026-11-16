/**
 * An expected, user-facing failure. The top-level handler in index.ts prints
 * `error: <message>` (no stack trace) and exits with status 1.
 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}
