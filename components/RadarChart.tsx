interface RadarChartProps {
  st?: number;
  dx?: number;
  iq?: number;
  ht?: number;
  size?: number;
  stroke?: string;
  fill?: string;
  showValues?: boolean;
}

const LABEL_STYLES = [
  { top: "-20px", left: "50%", transform: "translateX(-50%)", color: "#f87171" },
  { top: "50%", right: "-14px", transform: "translateY(-50%)", color: "#34d399" },
  { bottom: "-20px", left: "50%", transform: "translateX(-50%)", color: "#60a5fa" },
  { top: "50%", left: "-14px", transform: "translateY(-50%)", color: "#c084fc" },
];

export default function RadarChart({
  st,
  dx,
  iq,
  ht,
  size = 64,
  stroke = "#f59e0b",
  fill = "rgba(251,191,36,0.15)",
  showValues = false,
}: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const max = 20;
  const values = [st ?? 10, dx ?? 10, iq ?? 10, ht ?? 10];

  const point = (v: number, i: number) => {
    const pct = Math.min(1, v / max);
    const a = angles[i] - Math.PI / 2;
    return `${cx + r * pct * Math.cos(a)},${cy + r * pct * Math.sin(a)}`;
  };

  const pts = values.map(point).join(" ");
  const grid = [0.25, 0.5, 0.75, 1].map((pct) =>
    angles
      .map((a) => {
        const angle = a - Math.PI / 2;
        return `${cx + r * pct * Math.cos(angle)},${cy + r * pct * Math.sin(angle)}`;
      })
      .join(" ")
  );

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {grid.map((g) => (
          <polygon key={g} points={g} fill="none" stroke="#3f3f46" strokeWidth="0.5" />
        ))}
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="1.2" />
        {angles.map((a, i) => {
          const v = values[i] ?? 10;
          const pct = Math.min(1, v / max);
          const angle = a - Math.PI / 2;
          const px = cx + r * pct * Math.cos(angle);
          const py = cy + r * pct * Math.sin(angle);
          const lx = cx + r * Math.cos(angle);
          const ly = cy + r * Math.sin(angle);
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={lx} y2={ly} stroke="#3f3f46" strokeWidth="0.5" />
              <circle cx={px} cy={py} r={2} fill={stroke} />
            </g>
          );
        })}
      </svg>
      {showValues
        ? values.map((v, i) => (
            <div key={i} className="absolute" style={LABEL_STYLES[i]}>
              <span className="text-xs font-bold leading-none" style={{ color: LABEL_STYLES[i].color }}>
                {v}
              </span>
            </div>
          ))
        : null}
    </div>
  );
}
