'use client';

import { useState, useRef, useCallback } from 'react';

interface AutomationPoint {
  bar: number; // 0-based position
  value: number; // 0-1 normalized
}

interface AutomationLaneProps {
  label: string;
  color: string;
  points: AutomationPoint[];
  totalBars: number;
  pxPerBar: number;
  onChange: (points: AutomationPoint[]) => void;
}

export default function AutomationLane({ label, color, points, totalBars, pxPerBar, onChange }: AutomationLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const width = totalBars * pxPerBar;
  const height = 48;

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (draggingIdx !== null) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const bar = x / pxPerBar;
    const value = 1 - y / height;
    const newPoints = [...points, { bar, value: Math.max(0, Math.min(1, value)) }]
      .sort((a, b) => a.bar - b.bar);
    onChange(newPoints);
  }

  const handlePointDragStart = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingIdx(idx);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const handleMove = (ev: MouseEvent) => {
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const bar = Math.max(0, Math.min(totalBars, x / pxPerBar));
      const value = Math.max(0, Math.min(1, 1 - y / height));
      const newPoints = [...points];
      newPoints[idx] = { bar, value };
      onChange(newPoints.sort((a, b) => a.bar - b.bar));
    };

    const handleUp = () => {
      setDraggingIdx(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [points, pxPerBar, totalBars, height, onChange]);

  function handlePointRightClick(idx: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const newPoints = points.filter((_, i) => i !== idx);
    onChange(newPoints);
  }

  // Build path
  const pathPoints = points.map(p => ({
    x: p.bar * pxPerBar,
    y: (1 - p.value) * height,
  }));

  let pathD = '';
  if (pathPoints.length > 0) {
    pathD = `M 0 ${pathPoints[0]?.y ?? height} `;
    pathPoints.forEach(p => { pathD += `L ${p.x} ${p.y} `; });
    pathD += `L ${width} ${pathPoints[pathPoints.length - 1]?.y ?? height}`;
  }

  // Fill path (area under curve)
  let fillD = pathD;
  if (fillD) {
    fillD += ` L ${width} ${height} L 0 ${height} Z`;
  }

  return (
    <div className="flex items-stretch border-b border-white/[0.03]" style={{ height: height + 16 }}>
      {/* Label */}
      <div className="w-52 flex-shrink-0 border-r border-white/5 flex items-center px-3">
        <span className="text-[9px] font-medium" style={{ color }}>{label}</span>
      </div>

      {/* Automation curve */}
      <div className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} width={width} height={height}
          onClick={handleSvgClick}
          className="cursor-crosshair mt-2">
          {/* Grid lines */}
          {Array.from({ length: totalBars }, (_, i) => (
            <line key={i} x1={i * pxPerBar} y1={0} x2={i * pxPerBar} y2={height}
              stroke="rgba(255,255,255,0.03)" />
          ))}
          {/* Center line */}
          <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.05)" />

          {/* Fill */}
          {fillD && <path d={fillD} fill={`${color}10`} />}
          {/* Line */}
          {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />}

          {/* Points */}
          {pathPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4}
              fill={draggingIdx === i ? 'white' : color}
              stroke="white" strokeWidth={1}
              className="cursor-pointer"
              onMouseDown={(e) => handlePointDragStart(i, e)}
              onContextMenu={(e) => handlePointRightClick(i, e)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
