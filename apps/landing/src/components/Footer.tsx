import { Mail, MessageCircle } from 'lucide-react';
import { useLanguage } from '../i18n/context';
import { createWhatsAppHref, siteConfig } from '../site-config';

export function Footer() {
  const { t, locale } = useLanguage();

  const whatsappMsg =
    locale === 'ar'
      ? 'مرحباً، أود معرفة المزيد عن RestoCafe OS'
      : 'Hi, I want to learn more about RestoCafe OS';

  return (
    <footer className="relative overflow-hidden border-t border-white/8 bg-[#07110f] text-slate-400">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent" />
      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 lg:px-10 lg:py-18">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="brand-mark">
                <span className="text-sm font-semibold tracking-[0.22em] text-slate-950">RC</span>
              </div>
              <div>
                <div className="text-base font-semibold tracking-[0.18em] text-white">
                  {t.brand.name}
                </div>
                <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  {t.brand.descriptor}
                </div>
              </div>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-400">{t.footer.tagline}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {t.footer.quickLinksLabel}
            </h4>
            <ul className="mt-5 space-y-3">
              {t.nav.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-300 transition-colors duration-300 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {t.footer.contactLabel}
            </h4>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href={createWhatsAppHref(whatsappMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors duration-300 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4 text-brand-300" />
                  {t.footer.whatsappLabel}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors duration-300 hover:text-white"
                >
                  <Mail className="h-4 w-4 text-brand-300" />
                  {t.footer.emailLabel}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/8 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{t.footer.legal}</span>
          <span>{siteConfig.contactEmail}</span>
        </div>
      </div>
    </footer>
  );
}
