const DEFAULT_COLOR = '#444444';

function MarkerTriple({ color, suffix }: { color: string; suffix: string }) {
  return (
    <>
      <marker
        id={`arrowhead${suffix}`}
        markerWidth={10}
        markerHeight={7}
        refX={0}
        refY={3.5}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill={color} />
      </marker>
      <marker
        id={`arrowhead-thick${suffix}`}
        markerWidth={14}
        markerHeight={10}
        refX={0}
        refY={5}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 14 5, 0 10" fill={color} />
      </marker>
      <marker
        id={`arrowhead-reverse${suffix}`}
        markerWidth={10}
        markerHeight={7}
        refX={10}
        refY={3.5}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="10 0, 0 3.5, 10 7" fill={color} />
      </marker>
    </>
  );
}

export interface MarkerDefsResult {
  suffixMap: Map<string, string>;
}

export function MarkerDefs({ colors = [] }: { colors?: string[] }) {
  const unique = [DEFAULT_COLOR, ...colors.filter(c => c !== DEFAULT_COLOR)];
  const seen = new Set<string>();
  const ordered: { color: string; suffix: string }[] = [];
  let idx = 0;
  for (const c of unique) {
    if (seen.has(c)) continue;
    seen.add(c);
    const suffix = idx === 0 ? '' : `-${idx}`;
    ordered.push({ color: c, suffix });
    idx++;
  }
  return (
    <defs>
      {ordered.map(({ color, suffix }) => (
        <MarkerTriple key={suffix} color={color} suffix={suffix} />
      ))}
    </defs>
  );
}

/**
 * Build a color→suffix lookup map for marker ID references.
 * Must use the same dedup/ordering logic as MarkerDefs.
 */
export function buildSuffixMap(colors: string[]): Map<string, string> {
  const unique = [DEFAULT_COLOR, ...colors.filter(c => c !== DEFAULT_COLOR)];
  const seen = new Set<string>();
  const suffixMap = new Map<string, string>();
  let idx = 0;
  for (const c of unique) {
    if (seen.has(c)) continue;
    seen.add(c);
    suffixMap.set(c, idx === 0 ? '' : `-${idx}`);
    idx++;
  }
  return suffixMap;
}

export function markerEndRef(op: string, suffix: string): string | undefined {
  if (op === '--') return undefined;
  const base = op === '=' ? 'arrowhead-thick' : 'arrowhead';
  return `url(#${base}${suffix})`;
}

export function markerStartRef(op: string, suffix: string): string | undefined {
  if (op !== '<>') return undefined;
  return `url(#arrowhead-reverse${suffix})`;
}
