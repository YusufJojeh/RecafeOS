import { useLanguage } from '../i18n/context';

interface LanguageSwitcherProps {
  variant?: 'solid' | 'ghost';
}

export function LanguageSwitcher({ variant = 'ghost' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className={`inline-flex rounded-full border p-1 ${
        variant === 'solid'
          ? 'border-slate-200/75 bg-white text-slate-900 shadow-[0_20px_40px_-26px_rgba(15,23,42,0.35)]'
          : 'border-white/10 bg-white/6 text-white'
      }`}
      role="group"
      aria-label="Language switcher"
    >
      {(['en', 'ar'] as const).map((option) => {
        const active = locale === option;
        const label = option.toUpperCase();

        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.18em] transition-all duration-300 ${
              active
                ? variant === 'solid'
                  ? 'bg-slate-950 text-white'
                  : 'bg-white text-slate-950'
                : variant === 'solid'
                  ? 'text-slate-500 hover:text-slate-950'
                  : 'text-slate-300 hover:text-white'
            }`}
            aria-pressed={active}
            aria-label={option === 'en' ? 'Switch to English' : 'Switch to Arabic'}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
