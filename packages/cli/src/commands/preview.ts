import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { Command } from 'commander';

type PreviewOptions = {
  force?: boolean;
};

function isInteractiveSession(): boolean {
  return Boolean(process.stdout.isTTY && process.stderr.isTTY);
}

function isCiEnvironment(): boolean {
  return typeof process.env.CI === 'string' && process.env.CI.length > 0;
}

function openInBrowser(file: string): void {
  if (process.platform === 'darwin') {
    execFileSync('open', [file]);
    return;
  }

  if (process.platform === 'win32') {
    execFileSync('cmd', ['/c', 'start', '', file]);
    return;
  }

  execFileSync('xdg-open', [file]);
}

export const previewCommand = new Command('preview')
  .description('Open an existing SVG file in your default browser')
  .usage('<file> [--force]')
  .argument('<file>', 'SVG file to open')
  .option('--force', 'Open even when stdout/stderr are not TTYs or CI is set')
  .addHelpText('after', `
Notes:
  preview only opens an existing SVG file.
  Render first with: glypho render diagram.g --output diagram.svg
  preview refuses to open a browser in non-interactive or CI environments unless --force is passed.

Examples:
  glypho render diagram.g --output diagram.svg
  glypho preview diagram.svg
  glypho preview diagram.svg --force
`)
  .action((file: string, opts: PreviewOptions) => {
    if (extname(file).toLowerCase() !== '.svg') {
      console.error('error: preview expects an existing .svg file; render first with `glypho render <input> --output <file>.svg`');
      process.exitCode = 1;
      return;
    }

    const resolvedFile = resolve(file);
    if (!existsSync(resolvedFile)) {
      console.error(`error: file not found: ${resolvedFile}`);
      process.exitCode = 1;
      return;
    }

    if (!opts.force && (isCiEnvironment() || !isInteractiveSession())) {
      console.error('error: preview refused to open a browser in a non-interactive or CI environment; pass --force to override');
      process.exitCode = 1;
      return;
    }

    try {
      openInBrowser(resolvedFile);
      console.log(`→ opened ${resolvedFile}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`error: failed to open ${resolvedFile}: ${message}`);
      process.exitCode = 1;
    }
  });
