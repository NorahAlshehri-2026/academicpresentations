/** Small SVG charts. No hooks, so they render on the server. */

export function Radar({ values, labels, size = 260 }: { values: number[]; labels: string[]; size?: number }) {
  const n = values.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 34;
  const pt = (i: number, f: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = (f: (i: number) => number) =>
    values.map((_, i) => pt(i, f(i)).map((x) => x.toFixed(1)).join(",")).join(" ");

  return (
    <svg
      viewBox={`-50 0 ${size + 100} ${size}`}
      width="100%"
      style={{ maxWidth: size + 100, display: "block", margin: "0 auto" }}
      role="img"
      aria-label="Scores by criterion"
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={poly(() => f)} fill="none" stroke="var(--rule)" strokeWidth={1} />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="var(--rule)" />;
      })}
      <polygon
        points={poly((i) => Math.max(0.03, (values[i] || 0) / 4))}
        fill="rgba(184,134,15,.22)"
        stroke="var(--gold)"
        strokeWidth={2}
      />
      {values.map((v, i) => {
        const [x, y] = pt(i, Math.max(0.03, (v || 0) / 4));
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3.5} fill="var(--gold)" />;
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, 1.19);
        const anchor = Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end";
        return (
          <text key={l} x={x.toFixed(1)} y={(y + 4).toFixed(1)} textAnchor={anchor} fontSize={10} fontWeight={700} fill="var(--muted)">
            {l}
          </text>
        );
      })}
    </svg>
  );
}

export function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg viewBox="0 0 100 100" width={104} height={104} role="img" aria-label={`${label} ${sub}`}>
      <circle cx={50} cy={50} r={r} fill="none" stroke="var(--tint)" strokeWidth={10} />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke="var(--gold)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={c.toFixed(1)}
        strokeDashoffset={off.toFixed(1)}
        transform="rotate(-90 50 50)"
      />
      <text x={50} y={48} textAnchor="middle" fontSize={19} fontWeight={800} fill="var(--ink)">
        {label}
      </text>
      <text x={50} y={64} textAnchor="middle" fontSize={9} fill="var(--muted)">
        {sub}
      </text>
    </svg>
  );
}

export function Spark({ values, w = 320, h = 90 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - (v / 20) * h]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Score trend">
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="rgba(31,122,140,.16)" />
      <path d={d} fill="none" stroke="var(--teal)" strokeWidth={2.5} />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={3} fill="var(--teal)" />
      ))}
    </svg>
  );
}

export const RADAR_LABELS = ["Intro", "Organize", "Delivery", "Language", "Close"];
