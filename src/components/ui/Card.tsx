'use client';

import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const paddings = { sm: 'p-3', md: 'p-5', lg: 'p-8' };

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`bg-white/[0.02] border border-white/5 rounded-2xl ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
}
