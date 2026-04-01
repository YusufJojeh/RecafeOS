import { ArrowRight, MessageCircle } from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Button } from '../components/Button';
import { Section } from '../components/Section';
import { useLanguage } from '../i18n/context';
import { createWhatsAppHref, siteConfig } from '../site-config';

export function FinalCTA() {
  const { t, locale } = useLanguage();

  const whatsappMessage =
    locale === 'ar'
      ? 'مرحباً، أود بدء محادثة حول RestoCafe OS'
      : 'Hi, I want to start a conversation about RestoCafe OS';

  const ctaAlt =
    locale === 'ar'
      ? 'مشهد تحكم تشغيلي يبرز جاهزية RestoCafe OS للإطلاق'
      : 'Operational control scene highlighting RestoCafe OS launch readiness';

  return (
    <Section id="contact" className="pb-16 pt-8 sm:pb-20">
      <AnimateOnScroll>
        <div className="surface-card relative overflow-hidden rounded-[2.25rem] p-8 sm:p-10 lg:p-14">
          <div className="ambient-orb ambient-orb--emerald top-10 end-[12%]" />
          <div className="ambient-orb ambient-orb--amber bottom-4 start-[10%]" />

          <div className="relative grid gap-10 lg:grid-cols-[0.96fr_1.04fr] lg:items-center">
            <div className="text-start">
              <span className="section-eyebrow">{t.finalCta.eyebrow}</span>
              <h2 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.7rem] lg:leading-[1.02]">
                {t.finalCta.title}
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                {t.finalCta.description}
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
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
            </div>

            <div className="cta-scene">
              <div className="premium-art-frame cta-scene-frame">
                <img
                  src="/assets/mockups/hero-command-center.svg"
                  alt={ctaAlt}
                  className="art-image art-image--cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="art-gradient" />
              </div>

              <div className="cta-confidence-grid">
                {t.finalCta.confidencePoints.map((item, index) => (
                  <div key={item} className="premium-card rounded-[1.55rem] p-5">
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="mt-2 text-base font-medium text-white">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AnimateOnScroll>
    </Section>
  );
}
