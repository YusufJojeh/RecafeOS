import clsx from 'clsx';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'start' | 'center';
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'start',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={clsx(
        'max-w-3xl',
        align === 'center' ? 'mx-auto text-center' : 'text-start',
        className,
      )}
    >
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-pretty text-base leading-8 text-slate-300 sm:text-lg">
        {description}
      </p>
    </div>
  );
}
