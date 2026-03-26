'use client';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  suffix?: string;
  vertical?: boolean;
  className?: string;
}

export default function Slider({
  value, onChange, min = 0, max = 100, step = 1,
  label, showValue = true, suffix = '', vertical, className = '',
}: SliderProps) {
  return (
    <div className={`${vertical ? 'flex flex-col items-center' : ''} ${className}`}>
      {label && <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        {showValue && <span className="text-xs text-gray-600">{value}{suffix}</span>}
      </div>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`accent-teal-500 ${vertical ? 'h-24' : 'w-full'}`}
        style={vertical ? { writingMode: 'vertical-lr', direction: 'rtl' } : undefined}
      />
    </div>
  );
}
