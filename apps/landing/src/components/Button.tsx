import clsx from 'clsx';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  onClick?: () => void;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'border border-brand-300/40 bg-brand-400 text-slate-950 shadow-[0_22px_55px_-26px_rgba(53,211,153,0.85)] hover:-translate-y-0.5 hover:bg-brand-300 hover:shadow-[0_28px_65px_-28px_rgba(53,211,153,0.9)]',
  secondary:
    'border border-white/12 bg-white/6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-0.5 hover:bg-white/10',
  ghost:
    'border border-white/10 bg-transparent text-slate-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/6 hover:text-white',
  whatsapp:
    'border border-[#39d98a]/25 bg-[#25D366]/14 text-[#c4ffe4] shadow-[0_22px_48px_-28px_rgba(37,211,102,0.8)] hover:-translate-y-0.5 hover:bg-[#25D366]/20',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  className,
  onClick,
}: ButtonProps) {
  const classes = clsx(
    'relative inline-flex cursor-pointer select-none items-center justify-center rounded-full font-semibold tracking-[0.01em] transition-all duration-300 ease-out overflow-hidden before:pointer-events-none before:absolute before:inset-[1px] before:rounded-full before:bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_55%)] before:opacity-60 after:pointer-events-none after:absolute after:inset-y-0 after:start-[-35%] after:w-1/3 after:translate-x-[-180%] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.24),transparent)] after:transition-transform after:duration-700 hover:after:translate-x-[360%]',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        onClick={onClick}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        <span className="relative z-[1] inline-flex items-center justify-center gap-2">
          {children}
        </span>
      </a>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick}>
      <span className="relative z-[1] inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
