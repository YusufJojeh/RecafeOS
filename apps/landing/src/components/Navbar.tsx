import clsx from 'clsx';
import { Menu, MessageCircle, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../i18n/context';
import { createWhatsAppHref, siteConfig } from '../site-config';
import { Button } from './Button';
import { LanguageSwitcher } from './LanguageSwitcher';

const SCROLL_THRESHOLD = 50;

export function Navbar() {
  const { t, locale } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const whatsappMessage =
    locale === 'ar'
      ? 'مرحباً، أود معرفة المزيد عن RestoCafe OS'
      : 'Hi, I want to learn more about RestoCafe OS';

  const whatsappHref = createWhatsAppHref(whatsappMessage);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <div
        className={clsx(
          'pointer-events-auto mx-auto max-w-[1240px] rounded-[1.75rem] border transition-all duration-300',
          scrolled
            ? 'border-white/12 bg-[rgba(8,18,16,0.82)] shadow-[0_30px_100px_-40px_rgba(0,0,0,0.85)] backdrop-blur-2xl'
            : 'border-white/8 bg-[rgba(7,14,13,0.56)] backdrop-blur-xl',
        )}
      >
        <nav className="flex items-center justify-between gap-6 px-4 py-3 sm:px-5 lg:px-6">
          <a href="#top" className="flex min-w-0 items-center gap-3" onClick={closeMobile}>
            <div className="brand-mark">
              <span className="text-sm font-semibold tracking-[0.22em] text-slate-950">RC</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-[0.18em] text-white sm:text-base">
                {t.brand.name}
              </div>
              <div className="hidden text-[11px] uppercase tracking-[0.26em] text-slate-400 sm:block">
                {t.brand.descriptor}
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-6 lg:flex">
            {t.nav.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-300 transition-colors duration-300 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Button href={whatsappHref} variant="ghost" size="sm">
              <MessageCircle className="h-4 w-4" />
              {t.nav.whatsappCta}
            </Button>
            <LanguageSwitcher variant={scrolled ? 'solid' : 'ghost'} />
            <Button href={siteConfig.demoHref} size="md">
              {t.nav.primaryCta}
            </Button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher variant={scrolled ? 'solid' : 'ghost'} />
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-full border border-white/10 bg-white/6 p-2 text-white transition-colors duration-300 hover:bg-white/10"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <div
          className={clsx(
            'overflow-hidden transition-all duration-300 lg:hidden',
            mobileOpen ? 'max-h-[28rem] border-t border-white/8' : 'max-h-0',
          )}
        >
          <div className="space-y-3 px-4 py-4">
            {t.nav.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobile}
                className="block rounded-2xl border border-white/6 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition-colors duration-300 hover:border-white/12 hover:bg-white/[0.08] hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <Button href={siteConfig.demoHref} size="md" className="w-full" onClick={closeMobile}>
                {t.nav.primaryCta}
              </Button>
              <Button
                href={whatsappHref}
                variant="secondary"
                size="md"
                className="w-full"
                onClick={closeMobile}
              >
                <MessageCircle className="h-4 w-4" />
                {t.nav.whatsappCta}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
