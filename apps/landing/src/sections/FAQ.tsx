import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { Accordion } from '../components/Accordion';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Button } from '../components/Button';
import { Section } from '../components/Section';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n/context';
import { createWhatsAppHref, siteConfig } from '../site-config';

export function FAQ() {
  const { t, locale } = useLanguage();

  const whatsappMessage =
    locale === 'ar'
      ? 'مرحباً، لدي سؤال قبل حجز عرض RestoCafe OS'
      : 'Hi, I have a question before booking a RestoCafe OS demo';

  return (
    <Section id="faq">
      <div className="grid gap-10 xl:grid-cols-[1.04fr_0.96fr]">
        <div>
          <AnimateOnScroll>
            <SectionHeading
              eyebrow={t.faq.eyebrow}
              title={t.faq.title}
              description={t.faq.description}
            />
          </AnimateOnScroll>
          <AnimateOnScroll delay={120}>
            <div className="mt-8">
              <Accordion items={t.faq.items} />
            </div>
          </AnimateOnScroll>
        </div>

        <AnimateOnScroll delay={180}>
          <aside className="surface-card rounded-[2rem] p-7 sm:p-8">
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-white">
              {t.faq.asideTitle}
            </h3>
            <p className="mt-5 text-sm leading-7 text-slate-300 sm:text-[15px]">
              {t.faq.asideDescription}
            </p>
            <div className="mt-7 grid gap-3">
              {t.faq.asidePoints.map((item) => (
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
            <div className="mt-8 flex flex-col gap-3">
              <Button href={siteConfig.demoHref} size="lg">
                {t.finalCta.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                href={createWhatsAppHref(whatsappMessage)}
                variant="secondary"
                size="lg"
              >
                <MessageCircle className="h-4 w-4" />
                {t.finalCta.secondaryCta}
              </Button>
            </div>
          </aside>
        </AnimateOnScroll>
      </div>
    </Section>
  );
}
