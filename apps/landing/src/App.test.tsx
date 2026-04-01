import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('landing public surfaces', () => {
  it('renders public hero and FAQ sections', () => {
    render(<App />);
    expect(
      screen.getByText(
        /Command every shift with speed, clarity, and control\.|أدر كل وردية بسرعة ووضوح وسيطرة\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Common questions, direct answers\.|أسئلة متكررة وإجابات مباشرة\./i,
      ),
    ).toBeInTheDocument();
  });

  it('wires contact anchor CTA links', () => {
    render(<App />);
    const demoLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '#contact');
    expect(demoLinks.length).toBeGreaterThan(0);
  });

  it('toggles mobile menu button aria-expanded', () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: /Toggle navigation/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('contains footer whatsapp and email links', () => {
    render(<App />);
    const links = screen.getAllByRole('link');
    const whatsapp = links.find((l) => (l.getAttribute('href') ?? '').startsWith('https://wa.me/'));
    const mail = links.find((l) => (l.getAttribute('href') ?? '').startsWith('mailto:'));
    expect(whatsapp).toBeDefined();
    expect(mail).toBeDefined();
  });
});
