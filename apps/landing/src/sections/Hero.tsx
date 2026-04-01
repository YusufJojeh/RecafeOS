import clsx from 'clsx';
import {
  ArrowRight,
  Boxes,
  Check,
  ChefHat,
  Clock3,
  CreditCard,
  LayoutGrid,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Button } from '../components/Button';
import { InteractiveScene } from '../components/InteractiveScene';
import { useLanguage } from '../i18n/context';
import { createWhatsAppHref, siteConfig } from '../site-config';

const orbitIcons = [QrCode, CreditCard, ChefHat, Boxes];
const metricIcons = [Clock3, Sparkles, ShieldCheck];

const queueToneClasses = {
  steady: 'border-brand-300/12 bg-brand-400/10',
  warm: 'border-amber-300/14 bg-amber-300/10',
  alert: 'border-rose-300/14 bg-rose-300/10',
} as const;

const orbitPositions = [
  '-start-2 top-16 sm:-start-4',
  'end-0 top-12 sm:-end-2',
  'start-6 bottom-12 sm:start-12',
  'end-10 bottom-6',
];

export function Hero() {
  const { t, locale } = useLanguage();

  const whatsappMessage =
    locale === 'ar'
      ? 'مرحباً، أود حجز عرض مباشر لـ RestoCafe OS'
      : 'Hi, I want to book a live demo for RestoCafe OS';

  const heroAlt =
    locale === 'ar'
      ? 'مشهد تحكم تشغيلي فاخر يوضح إدارة الطاولات والمطبخ والتقارير في RestoCafe OS'
      : 'Premium operations control scene showing table management, kitchen flow, and reporting in RestoCafe OS';

  const activeTables = t.hero.stage.tables.length;

  return (
    <section
      id="top"
      className="relative overflow-hidden px-4 pb-18 pt-30 sm:px-6 sm:pb-22 sm:pt-34 lg:px-8 lg:pb-28 lg:pt-40"
    >
      <div className="ambient-grid" />
      <div className="ambient-orb ambient-orb--emerald top-24 start-[8%]" />
      <div className="ambient-orb ambient-orb--amber bottom-14 end-[9%]" />
      <div className="ambient-orb ambient-orb--shadow top-[40%] start-1/2" />

      <div className="mx-auto grid max-w-[1240px] gap-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div className="relative z-10 text-start">
          <AnimateOnScroll>
            <span className="section-eyebrow">{t.hero.badge}</span>
          </AnimateOnScroll>

          <AnimateOnScroll delay={80}>
            <h1 className="mt-6 max-w-3xl text-balance text-5xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-[5.5rem] lg:leading-[0.92]">
              {t.hero.title}{' '}
              <span className="text-brand-300">{t.hero.accent}</span>
            </h1>
          </AnimateOnScroll>

          <AnimateOnScroll delay={140}>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
              {t.hero.description}
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll delay={200}>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <Button href={siteConfig.demoHref} size="lg">
                {t.hero.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                href={createWhatsAppHref(whatsappMessage)}
                variant="secondary"
                size="lg"
              >
                <MessageCircle className="h-4 w-4" />
                {t.hero.secondaryCta}
              </Button>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll delay={260}>
            <ul className="mt-9 grid gap-3 sm:grid-cols-3">
              {t.hero.trustItems.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-400/12 text-brand-200">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="leading-6">{item}</span>
                </li>
              ))}
            </ul>
          </AnimateOnScroll>

          <AnimateOnScroll delay={320}>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {t.hero.metrics.map((metric, index) => {
                const Icon = metricIcons[index] ?? Sparkles;
                return (
                  <div key={metric.label} className="metric-tile">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-2xl font-semibold tracking-[-0.05em] text-white">
                          {metric.value}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">{metric.label}</div>
                      </div>
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-brand-200">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </AnimateOnScroll>
        </div>

        <AnimateOnScroll delay={180} className="relative">
          <InteractiveScene className="hero-stage">
            <div className="hero-visual-frame scene-surface">
              <div className="hero-visual-info">
                <span className="section-eyebrow">{t.hero.stage.eyebrow}</span>
                <h2 className="mt-4 max-w-lg text-2xl font-semibold tracking-[-0.04em] text-white sm:text-[2.1rem]">
                  {t.hero.stage.title}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                  {t.hero.stage.description}
                </p>
              </div>

              <div className="hero-visual-image-shell">
                <img
                  src="/assets/mockups/hero-command-center.svg"
                  alt={heroAlt}
                  className="hero-visual-image scene-layer scene-layer--base"
                  fetchPriority="high"
                />
              </div>
            </div>

            <div className="hero-floating-card hero-floating-card--queue scene-layer scene-layer--slow">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-100">
                  <ChefHat className="h-4 w-4" />
                </span>
                {t.hero.stage.queueLabel}
              </div>
              <div className="mt-4 space-y-3">
                {t.hero.stage.queue.slice(0, 2).map((item) => (
                  <div
                    key={`${item.title}-${item.time}`}
                    className={clsx(
                      'flex items-center justify-between gap-4 rounded-2xl border px-4 py-3',
                      queueToneClasses[item.tone],
                    )}
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.24em] text-white/65">
                        {item.station}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-white/80">{item.time}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-floating-card hero-floating-card--report scene-layer scene-layer--fast">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-200">
                  <Sparkles className="h-4 w-4" />
                </span>
                {t.hero.stage.reportLabel}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {t.hero.stage.report.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4"
                  >
                    <div className="text-lg font-semibold tracking-[-0.04em] text-white">
                      {item.value}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-floating-card hero-floating-card--floor scene-layer scene-layer--medium">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-200">
                  <LayoutGrid className="h-4 w-4" />
                </span>
                {t.hero.stage.floorLabel}
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-4xl font-semibold tracking-[-0.06em] text-white">
                    {activeTables}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.26em] text-slate-400">
                    {locale === 'ar' ? 'طاولات نشطة' : 'live tables'}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {t.hero.stage.tables.slice(0, 3).map((table) => (
                    <span
                      key={table.name}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-slate-200"
                    >
                      {table.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {t.hero.orbit.map((item, index) => {
              const Icon = orbitIcons[index] ?? QrCode;

              return (
                <div
                  key={item.title}
                  className={clsx(
                    'hero-orbit-card hidden sm:flex',
                    orbitPositions[index] ?? orbitPositions[0],
                  )}
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/7 text-brand-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                      {item.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </InteractiveScene>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
