#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { CliError } from './lib/errors.js';
import { checkCommand } from './commands/check.js';
import { parseCommand } from './commands/parse.js';
import { infoCommand } from './commands/info.js';
import { renderCommand } from './commands/render.js';
import { previewCommand } from './commands/preview.js';
import { toMermaidCommand } from './commands/to/mermaid.js';
import { fromMermaidCommand } from './commands/from/mermaid.js';
import { fromDotCommand } from './commands/from/dot.js';

// dist/index.js → ../package.json is this package's manifest (always published).
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
) as { version: string };

const configureGroupedHelp = (command: Command): Command =>
  command.configureHelp({
    subcommandTerm: (subcommand) => `${subcommand.name()} ${subcommand.usage()}`.trim(),
  });

const program = configureGroupedHelp(new Command());
program
  .name('glypho')
  .description('CLI for the .g graph notation format')
  .usage('<command> [arguments] [flags]')
  .version(version);

program.addHelpText('after', `
Examples:
  glypho check spec/examples/flowchart.g
  glypho render spec/examples/flowchart.g --output flowchart.svg
  glypho preview flowchart.svg
  glypho render spec/examples/flowchart.g --format png --output flowchart.png
  cat spec/examples/flowchart.g | glypho parse --compact

Command reference:
  glypho check [file] [--json] [--from <g|mermaid|dot>]
    Validate Glypho input and report parse errors.

  glypho parse [file] [--compact] [--from <g|mermaid|dot>]
    Parse Glypho input and print the JSON AST.

  glypho info [file] [--json] [--from <g|mermaid|dot>]
    Show node, edge, group, and token-count stats.

  glypho render [file] [--format <svg|png>] [--output <path>] [--from <g|mermaid|dot>] [--width <n>] [--height <n>] [--scale <n>]
    Render .g, .mmd/.mermaid, or .dot/.gv input to SVG or PNG.
    The format follows the --output extension; --format png forces PNG.
    Use --width/--height for SVG and --scale for PNG. Missing output directories are created.
    Render never opens a browser; use glypho preview <file.svg> after writing an SVG.

  glypho preview <file> [--force]
    Open an existing SVG file in your default browser.

  glypho to mermaid [file]
    Convert .g input to Mermaid flowchart text.

  glypho from mermaid [file]
    Convert Mermaid flowchart text to .g.

  glypho from dot [file]
    Convert Graphviz DOT text to .g.

Input format:
  check, parse, info, render and to mermaid detect .mmd/.mermaid and .dot/.gv by
  extension. Stdin is read as .g unless --from mermaid or --from dot is given.

Run glypho <command> --help for command-specific examples and option details.
`);

program.addCommand(checkCommand);
program.addCommand(parseCommand);
program.addCommand(infoCommand);
program.addCommand(renderCommand);
program.addCommand(previewCommand);

const to = configureGroupedHelp(new Command('to'))
  .description('Convert .g to text formats')
  .usage('<format> [file]')
  .addHelpText('after', `
Formats:
  glypho to mermaid [file]
    Convert Glypho input to Mermaid flowchart text.

Examples:
  glypho to mermaid spec/examples/flowchart.g
  cat spec/examples/flowchart.g | glypho to mermaid
`);
to.addCommand(toMermaidCommand);
program.addCommand(to);

const from = configureGroupedHelp(new Command('from'))
  .description('Convert text formats to .g')
  .usage('<format> [file]')
  .addHelpText('after', `
Formats:
  glypho from mermaid [file]
    Convert Mermaid flowchart text to .g.

  glypho from dot [file]
    Convert Graphviz DOT text to .g.

Examples:
  glypho from mermaid diagram.mmd
  glypho from dot graph.dot
`);
from.addCommand(fromMermaidCommand);
from.addCommand(fromDotCommand);
program.addCommand(from);

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CliError) {
    console.error(`error: ${error.message}`);
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    if (process.env.GLYPHO_DEBUG && error instanceof Error && error.stack) console.error(error.stack);
  }
  process.exitCode = 1;
}
