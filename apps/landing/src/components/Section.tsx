import clsx from 'clsx';
import type { ReactNode } from 'react';

interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
}

export function Section({ id, children, className }: SectionProps) {
  return (
    <section id={id} className={clsx('relative py-20 sm:py-24 lg:py-28', className)}>
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">{children}</div>
    </section>
  );
}
