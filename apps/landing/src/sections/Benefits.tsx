import { BarChart3, Clock3, ShieldCheck, Sparkles, TrendingUp, Users } from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Section } from '../components/Section';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n/context';

const benefitIcons = [Sparkles, Clock3, Users, BarChart3, TrendingUp, ShieldCheck];

export function Benefits() {
  const { t, locale } = useLanguage();

  const proofAlt =
    locale === 'ar'
      ? 'لوحة تحليل تشغيلية توضح مؤشرات الأداء اليومية داخل RestoCafe OS'
      : 'Operational analytics board showing daily performance inside RestoCafe OS';

  return (
    <Section>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <AnimateOnScroll>
          <SectionHeading
            eyebrow={t.benefits.eyebrow}
            title={t.benefits.title}
            description={t.benefits.description}
          />
        </AnimateOnScroll>
      </div>

      <div className="mt-12 grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <AnimateOnScroll>
          <div className="premium-art-frame benefit-showcase">
            <img
              src="/assets/illustrations/proof-dashboard.svg"
              alt={proofAlt}
              className="art-image art-image--cover"
              loading="lazy"
              decoding="async"
            />
            <div className="art-gradient" />
            <div className="benefit-showcase-copy">
              <span className="section-eyebrow">{t.benefits.highlight.label}</span>
              <h3 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                {t.benefits.highlight.value}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300 sm:text-[15px]">
                {locale === 'ar'
                  ? 'صورة موحدة للحركة على الصالة والمطبخ والكاشير والتقارير اليومية.'
                  : 'A unified view across the floor, kitchen, cashier, and the end-of-day operating pulse.'}
              </p>
            </div>
            <div className="benefit-showcase-strip">
              {t.benefits.items.slice(0, 3).map((item) => (
                <div key={item.title} className="metric-tile bg-black/30">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    {item.value}
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">{item.title}</div>
                </div>
              ))}
            </div>
          </div>
        </AnimateOnScroll>

        <div className="grid gap-4 sm:grid-cols-2">
          {t.benefits.items.map((item, index) => {
            const Icon = benefitIcons[index] ?? Sparkles;

            return (
              <AnimateOnScroll key={item.title} delay={index * 70}>
                <article className="premium-card premium-card-hover h-full rounded-[1.75rem] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="signal-chip">{item.value}</span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-brand-200">
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
