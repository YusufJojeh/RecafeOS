import { BarChart3, Boxes, ChefHat, CreditCard, LayoutGrid, QrCode } from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Section } from '../components/Section';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n/context';

const featureIcons = [QrCode, CreditCard, LayoutGrid, ChefHat, BarChart3, Boxes];

export function Features() {
  const { t, locale } = useLanguage();

  const networkAlt =
    locale === 'ar'
      ? 'تصور بصري مترابط يوضح كيف تتصل وحدات RestoCafe OS ببعضها'
      : 'Connected visual map showing how RestoCafe OS modules operate as one system';

  return (
    <Section id="features">
      <AnimateOnScroll>
        <SectionHeading
          eyebrow={t.features.eyebrow}
          title={t.features.title}
          description={t.features.description}
        />
      </AnimateOnScroll>

      <AnimateOnScroll delay={90}>
        <div className="premium-art-frame feature-banner mt-12">
          <img
            src="/assets/illustrations/module-network.svg"
            alt={networkAlt}
            className="art-image art-image--cover"
            loading="lazy"
            decoding="async"
          />
          <div className="art-gradient" />
          <div className="feature-banner-copy">
            <span className="section-eyebrow">
              {locale === 'ar' ? 'منظومة مترابطة' : 'Connected by design'}
            </span>
            <h3 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
              {locale === 'ar'
                ? 'كل وحدة تعرف ما الذي يحدث في الوحدة الأخرى.'
                : 'Every module understands the operational context of the next.'}
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-[15px]">
              {locale === 'ar'
                ? 'من لحظة المسح إلى التحضير والتحصيل والتقارير، يبقى المنتج متماسكاً بدل أن يتصرف كأدوات منفصلة.'
                : 'From guest scan to prep, cashier closeout, and reporting, the product behaves like one operating layer instead of disconnected tools.'}
            </p>
          </div>
          <div className="feature-banner-tags">
            {t.features.items.slice(0, 4).map((item) => (
              <span key={item.title} className="signal-chip">
                {item.title}
              </span>
            ))}
          </div>
        </div>
      </AnimateOnScroll>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {t.features.items.map((item, index) => {
          const Icon = featureIcons[index] ?? QrCode;

          return (
            <AnimateOnScroll key={item.title} delay={index * 70}>
              <article className="premium-card premium-card-hover group h-full rounded-[1.85rem] p-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="section-eyebrow">{item.eyebrow}</span>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-brand-200 transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.04]">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-[15px]">
                  {item.description}
                </p>
                <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-300">
                  {item.meta}
                </div>
              </article>
            </AnimateOnScroll>
          );
        })}
      </div>
    </Section>
  );
}
