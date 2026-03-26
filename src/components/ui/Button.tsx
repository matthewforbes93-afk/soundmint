'use client';

import { Loader2 } from 'lucide-react';
import { type ReactNode, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variants = {
  primary: 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/10',
  secondary: 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10',
  ghost: 'text-gray-400 hover:text-white hover:bg-white/5',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

const sizes = {
  sm: 'text-xs px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 rounded-xl',
  lg: 'text-base px-6 py-3.5 rounded-xl',
  xl: 'text-lg px-8 py-4 rounded-xl',
};

export default function Button({
  variant = 'primary', size = 'md', loading, icon, children, disabled, className = '', ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
