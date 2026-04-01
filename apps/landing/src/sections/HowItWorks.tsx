import { Check, Sparkles } from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Section } from '../components/Section';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n/context';

export function HowItWorks() {
  const { t } = useLanguage();

  return (
    <Section id="how-it-works">
      <div className="grid gap-10 xl:grid-cols-[0.94fr_1.06fr]">
        <AnimateOnScroll>
          <SectionHeading
            eyebrow={t.howItWorks.eyebrow}
            title={t.howItWorks.title}
            description={t.howItWorks.description}
          />
        </AnimateOnScroll>

        <div className="relative grid gap-4">
          <div className="absolute start-6 top-6 bottom-6 hidden w-px bg-white/10 sm:block" />
          {t.howItWorks.steps.map((step, index) => (
            <AnimateOnScroll key={step.title} delay={index * 80}>
              <article className="premium-card premium-card-hover relative rounded-[1.75rem] p-6 sm:ps-20">
                <div className="sm:absolute sm:start-6 sm:top-6">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-brand-300/20 bg-brand-400/12 text-sm font-semibold text-brand-100">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {step.detail}
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">
                  {step.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-[15px]">
                  {step.description}
                </p>
              </article>
            </AnimateOnScroll>
          ))}
        </div>
      </div>

      <AnimateOnScroll delay={220}>
        <div className="surface-card mt-10 rounded-[2rem] p-7 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-200">
              <Sparkles className="h-5 w-5" />
            </span>
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-white">
              {t.howItWorks.supportTitle}
            </h3>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-[15px]">
            {t.howItWorks.supportDescription}
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {t.howItWorks.supportPoints.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-slate-200"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-400/12 text-brand-200">
                  <Check className="h-4 w-4" />
                </span>
                <span className="leading-6">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </AnimateOnScroll>
    </Section>
  );
}
