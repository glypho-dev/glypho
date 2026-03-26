export function MarkerDefs() {
  return (
    <defs>
      <marker
        id="arrowhead"
        markerWidth={10}
        markerHeight={7}
        refX={9}
        refY={3.5}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#444444" />
      </marker>
      <marker
        id="arrowhead-thick"
        markerWidth={14}
        markerHeight={10}
        refX={13}
        refY={5}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 14 5, 0 10" fill="#444444" />
      </marker>
      <marker
        id="arrowhead-reverse"
        markerWidth={10}
        markerHeight={7}
        refX={1}
        refY={3.5}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="10 0, 0 3.5, 10 7" fill="#444444" />
      </marker>
    </defs>
  );
}
