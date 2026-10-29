/**
 * Small, dependency-free chart primitives for the dashboard. Nothing
 * fancy — plain SVG/CSS so we don't pull in a charting library for a
 * couple of summary visuals.
 */

interface MiniBarChartProps {
  /** One point per bar, in display order (oldest to newest). */
  points: { label: string; value: number }[];
  height?: number;
}

export function MiniBarChart({ points, height = 140 }: MiniBarChartProps) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="mini-bar-chart" style={{ height }}>
      {points.map((p, i) => (
        <div className="mini-bar-col" key={i}>
          <div className="mini-bar-track">
            <div
              className="mini-bar-fill"
              style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
              title={`${p.label}: ₹${p.value.toFixed(2)}`}
            />
          </div>
          <span className="mini-bar-label">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

const DONUT_COLORS = ["#059669", "#34d399", "#a7f3d0", "#fbbf24", "#f87171", "#60a5fa", "#a78bfa", "#f472b6"];

interface MiniDonutProps {
  slices: { label: string; value: number }[];
  size?: number;
}

export function MiniDonut({ slices, size = 120 }: MiniDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  let cumulative = 0;
  const stops: string[] = [];
  slices.forEach((s, i) => {
    const start = total === 0 ? 0 : (cumulative / total) * 360;
    cumulative += s.value;
    const end = total === 0 ? 0 : (cumulative / total) * 360;
    const color = DONUT_COLORS[i % DONUT_COLORS.length];
    stops.push(`${color} ${start}deg ${end}deg`);
  });
  const background = total === 0 ? "var(--border)" : `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="mini-donut-row">
      <div className="mini-donut" style={{ width: size, height: size, background }}>
        <div className="mini-donut-hole" />
      </div>
      <ul className="mini-donut-legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <span className="mini-donut-swatch" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span>{s.label}</span>
            <span className="muted">{total === 0 ? "0%" : `${Math.round((s.value / total) * 100)}%`}</span>
          </li>
        ))}
        {slices.length === 0 && <li className="muted">No data yet.</li>}
      </ul>
    </div>
  );
}
