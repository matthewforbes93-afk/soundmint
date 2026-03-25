'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Repeat, Copy, Scissors } from 'lucide-react';

interface TimelineClipProps {
  id: string;
  name: string;
  color: string;
  startBar: number;      // Position in bars (0-based)
  durationBars: number;  // Length in bars
  waveform: number[];    // Waveform data points
  pxPerBar: number;      // Pixels per bar (from zoom)
  selected: boolean;
  looping: boolean;
  onMove: (id: string, newStartBar: number) => void;
  onResize: (id: string, newDuration: number) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleLoop: (id: string) => void;
  onSplit: (id: string, atBar: number) => void;
}

export default function TimelineClip({
  id, name, color, startBar, durationBars, waveform, pxPerBar,
  selected, looping, onMove, onResize, onSelect, onDelete, onDuplicate, onToggleLoop, onSplit,
}: TimelineClipProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const clipRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, startBar: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, startBar };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartRef.current.x;
      const dBars = dx / pxPerBar;
      const newStart = Math.max(0, Math.round((dragStartRef.current.startBar + dBars) * 4) / 4); // Snap to quarter bars
      onMove(id, newStart);
    };

    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [id, startBar, pxPerBar, onMove, onSelect, isResizing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startDuration = durationBars;

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dBars = dx / pxPerBar;
      const newDuration = Math.max(0.25, Math.round((startDuration + dBars) * 4) / 4);
      onResize(id, newDuration);
    };

    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [id, durationBars, pxPerBar, onResize]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
    // Close on click outside
    const close = () => { setShowMenu(false); window.removeEventListener('click', close); };
    setTimeout(() => window.addEventListener('click', close), 0);
  };

  const left = startBar * pxPerBar;
  const width = durationBars * pxPerBar;

  return (
    <>
      <div
        ref={clipRef}
        onMouseDown={handleDragStart}
        onContextMenu={handleContextMenu}
        className={`absolute top-1 bottom-1 rounded-md overflow-hidden group transition-shadow ${
          isDragging ? 'opacity-80 shadow-lg shadow-white/10 z-30' : 'z-10'
        } ${selected ? 'ring-1 ring-white/40' : ''}`}
        style={{
          left, width: Math.max(width, 8),
          background: `${color}15`,
          borderLeft: `2px solid ${color}60`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {/* Clip name */}
        <div className="absolute top-0 left-1 right-4 z-10 flex items-center gap-1 py-0.5">
          <span className="text-[8px] font-medium truncate" style={{ color: `${color}cc` }}>{name}</span>
          {looping && <Repeat className="w-2.5 h-2.5 flex-shrink-0" style={{ color: `${color}88` }} />}
        </div>

        {/* Waveform */}
        {waveform.length > 0 && (
          <svg viewBox={`0 0 ${waveform.length} 60`} preserveAspectRatio="none" className="w-full h-full opacity-60">
            {waveform.map((v, i) => (
              <rect key={i} x={i} y={30 - v * 25} width={0.8} height={v * 50} fill={color} opacity={0.5} />
            ))}
          </svg>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(id); }}
          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
        >
          <X className="w-2.5 h-2.5 text-white/60" />
        </button>

        {/* Resize handle (right edge) */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 z-20"
        />

        {/* Loop indicator */}
        {looping && (
          <div className="absolute right-0 top-0 bottom-0 w-full pointer-events-none"
            style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${width}px, ${color}20 ${width}px, ${color}10 ${width * 2}px)` }} />
        )}
      </div>

      {/* Context menu */}
      {showMenu && (
        <div className="fixed z-50 bg-gray-900 border border-white/10 rounded-lg py-1 shadow-xl" style={{ left: menuPos.x, top: menuPos.y }}>
          {[
            { label: 'Split Here', icon: Scissors, action: () => onSplit(id, startBar + durationBars / 2) },
            { label: 'Duplicate', icon: Copy, action: () => onDuplicate(id) },
            { label: 'Toggle Loop', icon: Repeat, action: () => onToggleLoop(id) },
            { label: 'Delete', icon: X, action: () => onDelete(id) },
          ].map(({ label, icon: Icon, action }) => (
            <button key={label} onClick={() => { action(); setShowMenu(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 hover:text-white">
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
