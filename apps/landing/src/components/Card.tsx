import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  icon: ReactNode;
  title: string;
  description: string;
  variant?: 'light' | 'dark';
  className?: string;
}

export function Card({
  icon,
  title,
  description,
  variant = 'light',
  className,
}: CardProps) {
  return (
    <div
      className={clsx(
        'group rounded-2xl p-6 transition-all duration-300',
        variant === 'light'
          ? 'bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5'
          : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-0.5',
        className,
      )}
    >
      <div
        className={clsx(
          'mb-4 flex h-12 w-12 items-center justify-center rounded-xl',
          variant === 'light'
            ? 'bg-brand-50 text-brand-600'
            : 'bg-brand-500/20 text-brand-400',
        )}
      >
        {icon}
      </div>
      <h3
        className={clsx(
          'mb-2 text-lg font-semibold',
          variant === 'light' ? 'text-slate-900' : 'text-white',
        )}
      >
        {title}
      </h3>
      <p
        className={clsx(
          'text-sm leading-relaxed',
          variant === 'light' ? 'text-slate-600' : 'text-slate-300',
        )}
      >
        {description}
      </p>
    </div>
  );
}
