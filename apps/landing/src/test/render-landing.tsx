import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LanguageProvider } from '../i18n/context';

type RenderLandingOptions = {
  route?: string;
  locale?: 'en' | 'ar';
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
};

export function renderWithLandingProviders(
  ui: ReactElement,
  options: RenderLandingOptions = {},
) {
  if (options.locale) {
    localStorage.setItem('restocafe-lang', options.locale);
  }
  return render(<LanguageProvider>{ui}</LanguageProvider>, options.renderOptions);
}
