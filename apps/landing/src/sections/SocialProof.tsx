import { Star } from 'lucide-react';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { Section } from '../components/Section';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n/context';

export function SocialProof() {
  const { t, locale } = useLanguage();

  const venueAlt =
    locale === 'ar'
      ? 'مشهد ضيافة راقٍ يعكس أجواء المطاعم والمقاهي التي يستخدم فيها RestoCafe OS'
      : 'Premium hospitality scene representing the restaurants and cafes that run on RestoCafe OS';

  const proofAlt =
    locale === 'ar'
      ? 'لوحة بيانات تشغيلية تعكس وضوح الإدارة وثقة نهاية اليوم'
      : 'Operational proof dashboard showing management clarity and end-of-day confidence';

  const [featuredTestimonial, ...otherTestimonials] = t.socialProof.testimonials;

  return (
    <Section>
      <AnimateOnScroll>
        <SectionHeading
          eyebrow={t.socialProof.eyebrow}
          title={t.socialProof.title}
          description={t.socialProof.description}
          align="center"
        />
      </AnimateOnScroll>

      <AnimateOnScroll delay={120}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {t.socialProof.sectors.map((sector) => (
            <span key={sector} className="signal-chip">
              {sector}
            </span>
          ))}
        </div>
      </AnimateOnScroll>

      <div className="mt-12 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <AnimateOnScroll>
          <div className="premium-art-frame social-showcase">
            <img
              src="/assets/illustrations/venue-atmosphere.svg"
              alt={venueAlt}
              className="art-image art-image--cover"
              loading="lazy"
              decoding="async"
            />
            <div className="art-gradient" />

            <div className="social-showcase-quote">
              <div className="flex items-center gap-1 text-amber-200">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-5 text-lg leading-8 text-white">{featuredTestimonial?.quote}</p>
              <div className="mt-6 border-t border-white/8 pt-4">
                <div className="text-sm font-semibold text-white">{featuredTestimonial?.author}</div>
                <div className="mt-1 text-sm text-slate-400">{featuredTestimonial?.role}</div>
              </div>
            </div>

            <div className="social-showcase-stats">
              {t.socialProof.stats.map((item) => (
                <div key={item.label} className="metric-tile bg-black/30 text-center">
                  <div className="text-3xl font-semibold tracking-[-0.05em] text-white">
                    {item.value}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </AnimateOnScroll>

        <div className="grid gap-4">
          <AnimateOnScroll delay={90}>
            <div className="premium-art-frame social-proof-card">
              <img
                src="/assets/illustrations/proof-dashboard.svg"
                alt={proofAlt}
                className="art-image art-image--cover"
                loading="lazy"
                decoding="async"
              />
              <div className="art-gradient art-gradient--soft" />
              <div className="social-proof-overlay">
                <span className="section-eyebrow">
                  {locale === 'ar' ? 'ثقة تشغيلية' : 'Operational confidence'}
                </span>
                <p className="mt-4 max-w-lg text-sm leading-7 text-slate-200 sm:text-[15px]">
                  {locale === 'ar'
                    ? 'الصورة الجيدة لا تأتي من الانطباعات، بل من إشارات تشغيلية نظيفة يمكن الوثوق بها يومياً.'
                    : 'Strong conviction comes from clean operating signals that owners and managers can trust every single day.'}
                </p>
              </div>
            </div>
          </AnimateOnScroll>

          <div className="grid gap-4 sm:grid-cols-2">
            {otherTestimonials.map((testimonial, index) => (
              <AnimateOnScroll key={testimonial.author} delay={160 + index * 70}>
                <article className="premium-card premium-card-hover h-full rounded-[1.85rem] p-6">
                  <div className="flex items-center gap-1 text-amber-200">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star key={starIndex} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-6 text-base leading-8 text-slate-200">{testimonial.quote}</p>
                  <div className="mt-8 border-t border-white/8 pt-5">
                    <div className="text-sm font-semibold text-white">{testimonial.author}</div>
                    <div className="mt-1 text-sm text-slate-400">{testimonial.role}</div>
                    <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.24em] text-brand-200">
                      {testimonial.outcome}
                    </div>
                  </div>
                </article>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
