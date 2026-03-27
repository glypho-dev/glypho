const DEFAULT_COLOR = '#444444';

function markerId(base: string, color: string): string {
  if (color === DEFAULT_COLOR) return base;
  return `${base}-${color.replace('#', '')}`;
}

function MarkerTriple({ color }: { color: string }) {
  const suffix = color === DEFAULT_COLOR ? '' : `-${color.replace('#', '')}`;
  return (
    <>
      <marker
        id={`arrowhead${suffix}`}
        markerWidth={10}
        markerHeight={7}
        refX={9}
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
        refX={13}
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
        refX={1}
        refY={3.5}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="10 0, 0 3.5, 10 7" fill={color} />
      </marker>
    </>
  );
}

export function MarkerDefs({ colors = [] }: { colors?: string[] }) {
  const unique = [DEFAULT_COLOR, ...colors.filter(c => c !== DEFAULT_COLOR)];
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const c of unique) {
    if (seen.has(c)) continue;
    seen.add(c);
    deduped.push(c);
  }
  return (
    <defs>
      {deduped.map(c => (
        <MarkerTriple key={c} color={c} />
      ))}
    </defs>
  );
}

export function markerEndRef(op: string, color: string): string | undefined {
  if (op === '--') return undefined;
  const base = op === '=' ? 'arrowhead-thick' : 'arrowhead';
  return `url(#${markerId(base, color)})`;
}

export function markerStartRef(op: string, color: string): string | undefined {
  if (op !== '<>') return undefined;
  return `url(#${markerId('arrowhead-reverse', color)})`;
}
