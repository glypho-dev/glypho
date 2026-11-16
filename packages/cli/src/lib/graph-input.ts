import { parse, parseDot, parseMermaid, type Graph } from '@glypho/parser';
import { detectFormat, parseInputFormat, type InputFormat } from './detect-format.js';
import { formatInputName, readInput, resolveInputFile } from './io.js';

export type ParseIssue = {
  message: string;
  line: number;
  column?: number;
};

type ParseResult = {
  graph: Graph;
  errors: ParseIssue[];
};

export type LoadedGraph = {
  file: string;
  name: string;
  format: InputFormat;
  graph: Graph;
  errors: ParseIssue[];
};

/**
 * Read and parse input. The format comes from `from` (a --from value) when
 * given, otherwise from the file extension (stdin defaults to .g).
 */
export function loadGraph(file?: string, from?: string): LoadedGraph {
  const inputFile = resolveInputFile(file);
  const format = from ? parseInputFormat(from) : detectFormat(inputFile);
  const input = readInput(inputFile);

  let result: ParseResult;
  switch (format) {
    case 'mermaid':
      result = parseMermaid(input);
      break;
    case 'dot':
      result = parseDot(input);
      break;
    default:
      result = parse(input);
      break;
  }

  return {
    file: inputFile,
    name: formatInputName(inputFile),
    format,
    graph: result.graph,
    errors: result.errors,
  };
}

export function printParseErrors(file: string, errors: ParseIssue[]): void {
  for (const err of errors) {
    console.error(`${file}:${err.line}:${err.column ?? 1}: ${err.message}`);
  }
}
