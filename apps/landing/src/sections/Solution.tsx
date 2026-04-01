import { BarChart3, ChefHat, LayoutGrid } from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Section } from '../components/Section';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n/context';

const pillarIcons = [LayoutGrid, ChefHat, BarChart3];

export function Solution() {
  const { t } = useLanguage();

  return (
    <Section id="solution">
      <AnimateOnScroll>
        <SectionHeading
          eyebrow={t.solution.eyebrow}
          title={t.solution.title}
          description={t.solution.description}
        />
      </AnimateOnScroll>

      <div className="mt-12 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="grid gap-4">
          {t.solution.pillars.map((item, index) => {
            const Icon = pillarIcons[index] ?? LayoutGrid;

            return (
              <AnimateOnScroll key={item.title} delay={index * 80}>
                <article className="premium-card premium-card-hover rounded-[1.75rem] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
                        {item.title}
                      </h3>
                    </div>
                    <span className="signal-chip">{item.stat}</span>
                  </div>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                    {item.description}
                  </p>
                </article>
              </AnimateOnScroll>
            );
          })}
        </div>

        <AnimateOnScroll delay={180}>
          <div className="surface-card h-full rounded-[2rem] p-7 sm:p-8">
            <div className="section-eyebrow">{t.solution.railTitle}</div>
            <div className="relative mt-8">
              <div className="absolute start-5 top-3 bottom-3 w-px bg-white/10 md:inset-x-8 md:top-1/2 md:h-px md:w-auto md:-translate-y-1/2" />
              <div className="grid gap-4 md:grid-cols-5">
                {t.solution.railItems.map((item, index) => (
                  <div key={item} className="relative ps-12 md:ps-0">
                    <div className="absolute start-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-300/20 bg-brand-400/12 text-sm font-semibold text-brand-100 md:relative md:mx-auto">
                      {index + 1}
                    </div>
                    <div className="mt-2 text-sm font-medium text-white md:text-center">
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-10 max-w-xl text-sm leading-7 text-slate-300 sm:text-[15px]">
              {t.solution.railCaption}
            </p>
          </div>
        </AnimateOnScroll>
      </div>
    </Section>
  );
}
