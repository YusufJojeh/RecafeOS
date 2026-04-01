import { BarChart3, CreditCard, LayoutGrid, Users } from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Section } from '../components/Section';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n/context';

const painIcons = [CreditCard, LayoutGrid, BarChart3, Users];

export function PainPoints() {
  const { t } = useLanguage();

  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <AnimateOnScroll>
          <div>
            <SectionHeading
              eyebrow={t.pain.eyebrow}
              title={t.pain.title}
              description={t.pain.description}
            />
          </div>
        </AnimateOnScroll>

        <div className="grid gap-4 sm:grid-cols-2">
          {t.pain.items.map((item, index) => {
            const Icon = painIcons[index] ?? CreditCard;

            return (
              <AnimateOnScroll key={item.title} delay={index * 80}>
                <article className="premium-card premium-card-hover h-full rounded-[1.75rem] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="signal-chip signal-chip--warm">{item.signal}</span>
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-brand-200">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold tracking-[-0.03em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-[15px]">
                    {item.description}
                  </p>
                </article>
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
