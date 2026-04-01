import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLanguage } from '../i18n/context';
import { renderWithLandingProviders } from './render-landing';

function Probe() {
  const { locale } = useLanguage();
  return <div>{locale}</div>;
}

describe('renderWithLandingProviders', () => {
  it('renders with language provider and default locale', () => {
    renderWithLandingProviders(<Probe />);
    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('accepts explicit locale option', () => {
    renderWithLandingProviders(<Probe />, { locale: 'ar' });
    expect(screen.getByText('ar')).toBeInTheDocument();
  });
});
