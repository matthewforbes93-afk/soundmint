'use client';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
}

export default function Toggle({ value, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div>
          {label && <p className="text-sm text-white">{label}</p>}
          {description && <p className="text-[10px] text-gray-500">{description}</p>}
        </div>
      )}
      <button onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-teal-600' : 'bg-gray-700'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
