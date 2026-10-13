// Named callouts laid over a figure: a dot on the part, a thin leader, the name in
// the card's empty space. They sit on their own layer above the drawing, so the
// art itself never changes, and a toggle hides them. Below 640 px only the
// numbers show, and the key list under the figure carries the names.

export interface Callout {
  n: number;
  name: string;
  at: [number, number]; // the part, in viewBox units
  to: [number, number]; // where the leader ends and the name starts
  align: "start" | "end"; // the name runs right of `to` (start) or left of it (end)
}

const pct = (value: number, of: number) => `${((value / of) * 100).toFixed(3)}%`;

export function Callouts({ items, width, height, show }: { items: Callout[]; width: number; height: number; show: boolean }) {
  return (
    <div className="callouts" data-show={show ? "" : undefined} aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} focusable="false">
        {items.map(({ n, at, to }) => {
          const d = `M${at[0]} ${at[1]}L${to[0]} ${to[1]}`;
          return (
            <g key={n}>
              <path className="callout-halo" d={d} />
              <path className="callout-line" d={d} />
              <circle className="callout-dot" cx={at[0]} cy={at[1]} r="1.5" />
              <circle className="callout-end" cx={to[0]} cy={to[1]} r="0.9" />
            </g>
          );
        })}
      </svg>
      {items.map(({ n, name, to, align }) => (
        <span key={n} className="callout" data-align={align} style={{ left: pct(to[0], width), top: pct(to[1], height) }}>
          <b>{n}</b>
          <span className="callout-name">{name}</span>
        </span>
      ))}
    </div>
  );
}

// The same names as a numbered list, shown under the figure on narrow screens.
export function CalloutKey({ items, show }: { items: Callout[]; show: boolean }) {
  return (
    <ol className="callout-key" data-show={show ? "" : undefined}>
      {items.map(({ n, name }) => (
        <li key={n}>
          <b>{n}</b>
          {name}
        </li>
      ))}
    </ol>
  );
}
