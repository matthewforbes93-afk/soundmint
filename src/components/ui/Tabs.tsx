'use client';

import { type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-0.5">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            active === tab.id ? 'bg-white/[0.06] text-white' : 'text-gray-600 hover:text-gray-300'
          }`}>
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
