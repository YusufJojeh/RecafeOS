import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useLanguage } from './context';

function Probe() {
  const { locale, dir, setLocale } = useLanguage();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <button type="button" onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>
        toggle
      </button>
    </div>
  );
}

describe('i18n context', () => {
  it('throws if useLanguage is used outside provider', () => {
    const bad = () => render(<Probe />);
    expect(bad).toThrow('useLanguage must be used within LanguageProvider');
  });

  it('initializes from localStorage and updates html attrs when toggled', () => {
    localStorage.setItem('restocafe-lang', 'ar');
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    expect(document.documentElement.lang).toBe('ar');
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('falls back safely when localStorage access throws', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
