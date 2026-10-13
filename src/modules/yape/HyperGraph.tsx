import React from 'react';

interface Dataset {
  data: number[];
  color: string;
  label: string;
  areaColor?: string;
}

interface HyperGraphProps {
  datasets: Dataset[];
  labels: string[];
  dateRange: string;
  animateKey: string;
  title?: string;
  showLegend?: boolean;
  height?: number;
  unit?: string;
  isPercentage?: boolean;
}

export const HyperGraph: React.FC<HyperGraphProps> = ({
  datasets,
  labels,
  dateRange,
  animateKey,
  title = 'Ingresos Totales',
  showLegend = false,
  height = 200,
  unit = 'S/',
  isPercentage = false
}) => {
  const width = 400;
  const paddingX = 40;
  const paddingY = 25;
  const contentWidth = width - paddingX * 2;
  const contentHeight = height - paddingY * 2;

  const allData = datasets.flatMap((d) => d.data);
  const maxValInData = allData.length > 0 ? Math.max(...allData) : 0;
  const maxY = maxValInData > 0 ? maxValInData * 1.25 : 100;

  const generatePath = (data: number[]) => {
    if (!data || data.length === 0)
      return {
        d: `M ${paddingX},${height - paddingY} L ${width - paddingX},${height - paddingY}`,
        points: [] as { x: number; y: number; val: number }[]
      };

    const points = data.map((val, i) => {
      const x = paddingX + (i / Math.max(1, data.length - 1)) * contentWidth;
      const y = height - paddingY - (val / maxY) * contentHeight;
      return { x, y, val };
    });

    if (points.length === 1) {
      const x = width / 2;
      const y = height - paddingY - (data[0] / maxY) * contentHeight;
      return { d: `M ${paddingX},${y} L ${width - paddingX},${y}`, points: [{ x, y, val: data[0] }] };
    }

    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
    }

    return { d, points };
  };

  const generateAreaPath = (linePath: string) => {
    return `${linePath} L ${width - paddingX},${height - paddingY} L ${paddingX},${height - paddingY} Z`;
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex justify-between items-center w-full px-2 mb-2">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>
        <span className="text-[10px] font-mono text-cyan-400 font-bold">{dateRange}</span>
      </div>

      <div className="w-full relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            {datasets.map((dataset, idx) => (
              <linearGradient key={`grad-${idx}`} id={`grad-${idx}-${animateKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={dataset.areaColor || dataset.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={dataset.areaColor || dataset.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((p, i) => {
            const y = height - paddingY - p * contentHeight;
            return (
              <g key={`grid-${i}`}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <text x={paddingX - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">
                  {unit} {Math.round(p * maxY)}
                </text>
              </g>
            );
          })}

          {/* Datasets */}
          {datasets.map((dataset, idx) => {
            const { d, points } = generatePath(dataset.data);
            const areaD = generateAreaPath(d);
            return (
              <g key={`dataset-${idx}`}>
                <path d={areaD} fill={`url(#grad-${idx}-${animateKey})`} />
                <path d={d} fill="none" stroke={dataset.color} strokeWidth="2.5" strokeLinecap="round" />
                {points.map((p, pIdx) => (
                  <circle key={`p-${pIdx}`} cx={p.x} cy={p.y} r="3" fill="#0f172a" stroke={dataset.color} strokeWidth="2" />
                ))}
              </g>
            );
          })}

          {/* X Axis Labels */}
          {labels.map((lbl, i) => {
            const x = paddingX + (i / Math.max(1, labels.length - 1)) * contentWidth;
            return (
              <text key={`lbl-${i}`} x={x} y={height - 6} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="bold">
                {lbl}
              </text>
            );
          })}
        </svg>
      </div>

      {showLegend && (
        <div className="flex gap-4 mt-2 justify-center">
          {datasets.map((d, idx) => (
            <div key={`leg-${idx}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
