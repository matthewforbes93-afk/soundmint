'use client';

import { useState } from 'react';

interface Section {
  id: string;
  name: string;
  startBar: number;
  color: string;
}

const SECTION_PRESETS = [
  { name: 'Intro', color: '#22d3ee' },
  { name: 'Verse', color: '#34d399' },
  { name: 'Chorus', color: '#a78bfa' },
  { name: 'Bridge', color: '#fbbf24' },
  { name: 'Outro', color: '#f472b6' },
  { name: 'Drop', color: '#ef4444' },
  { name: 'Break', color: '#6366f1' },
];

interface ArrangementMarkersProps {
  sections: Section[];
  totalBars: number;
  pxPerBar: number;
  onChange: (sections: Section[]) => void;
}

export default function ArrangementMarkers({ sections, totalBars, pxPerBar, onChange }: ArrangementMarkersProps) {
  const [adding, setAdding] = useState(false);

  function addSection(preset: typeof SECTION_PRESETS[0], bar: number) {
    const newSection: Section = {
      id: `sec-${Date.now()}`,
      name: preset.name,
      startBar: bar,
      color: preset.color,
    };
    onChange([...sections, newSection].sort((a, b) => a.startBar - b.startBar));
    setAdding(false);
  }

  function removeSection(id: string) {
    onChange(sections.filter(s => s.id !== id));
  }

  return (
    <div className="h-6 relative border-b border-white/5 bg-white/[0.01]" style={{ marginLeft: 208 }}>
      {/* Section markers */}
      {sections.map((section, i) => {
        const nextBar = sections[i + 1]?.startBar || totalBars;
        const width = (nextBar - section.startBar) * pxPerBar;
        return (
          <div key={section.id}
            className="absolute top-0 bottom-0 flex items-center px-2 border-r border-white/10 group cursor-pointer"
            style={{ left: section.startBar * pxPerBar, width, background: `${section.color}08` }}
            onDoubleClick={() => removeSection(section.id)}>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: section.color }}>
              {section.name}
            </span>
          </div>
        );
      })}

      {/* Add button */}
      {!adding ? (
        <button onClick={() => setAdding(true)}
          className="absolute right-2 top-1 text-[8px] text-gray-600 hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">
          + Section
        </button>
      ) : (
        <div className="absolute right-2 top-0 flex gap-0.5 bg-gray-900 rounded border border-white/10 p-1 z-30">
          {SECTION_PRESETS.map(preset => (
            <button key={preset.name}
              onClick={() => {
                const lastBar = sections.length > 0 ? Math.max(...sections.map(s => s.startBar)) + 8 : 0;
                addSection(preset, lastBar);
              }}
              className="text-[8px] px-1.5 py-0.5 rounded hover:bg-white/10"
              style={{ color: preset.color }}>
              {preset.name}
            </button>
          ))}
          <button onClick={() => setAdding(false)} className="text-[8px] text-gray-500 px-1">&#x2715;</button>
        </div>
      )}
    </div>
  );
}
