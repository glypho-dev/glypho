#!/usr/bin/env node
import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { parseCommand } from './commands/parse.js';
import { infoCommand } from './commands/info.js';
import { renderCommand } from './commands/render.js';
import { previewCommand } from './commands/preview.js';
import { toMermaidCommand } from './commands/to/mermaid.js';
import { fromMermaidCommand } from './commands/from/mermaid.js';
import { fromDotCommand } from './commands/from/dot.js';

const configureGroupedHelp = (command: Command): Command =>
  command.configureHelp({
    subcommandTerm: (subcommand) => `${subcommand.name()} ${subcommand.usage()}`.trim(),
  });

const program = configureGroupedHelp(new Command());
program
  .name('glypho')
  .description('CLI for the .g graph notation format')
  .usage('<command> [arguments] [flags]')
  .version('0.1.0');

program.addHelpText('after', `
Examples:
  glypho check spec/examples/flowchart.g
  glypho render spec/examples/flowchart.g --output flowchart.svg
  glypho preview flowchart.svg
  glypho render spec/examples/flowchart.g --format png --output flowchart.png
  cat spec/examples/flowchart.g | glypho parse --compact

Command reference:
  glypho check [file] [--json]
    Validate Glypho input and report parse errors.

  glypho parse [file] [--compact]
    Parse Glypho input and print the JSON AST.

  glypho info [file] [--json]
    Show node, edge, group, and token-count stats.

  glypho render [file] [--format <svg|png>] [--output <path>] [--width <n>] [--height <n>] [--scale <n>]
    Render .g, .mmd/.mermaid, or .dot/.gv input to SVG or PNG.
    Use --format png for PNG output. Use --width/--height for SVG and --scale for PNG.
    Render never opens a browser; use glypho preview <file.svg> after writing an SVG.

  glypho preview <file> [--force]
    Open an existing SVG file in your default browser.

  glypho to mermaid [file]
    Convert .g input to Mermaid flowchart text.

  glypho from mermaid [file]
    Convert Mermaid flowchart text to .g.

  glypho from dot [file]
    Convert Graphviz DOT text to .g.

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

program.parse();
