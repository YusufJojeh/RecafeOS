import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimateOnScroll } from './AnimateOnScroll';

type ObserverInstance = {
  trigger: (isIntersecting: boolean) => void;
  disconnect: ReturnType<typeof vi.fn>;
};

const instances: ObserverInstance[] = [];

class IntersectionObserverMock {
  private callback: IntersectionObserverCallback;
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    instances.push({
      trigger: (isIntersecting: boolean) =>
        this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver),
      disconnect: this.disconnect,
    });
  }
}

describe('AnimateOnScroll', () => {
  afterEach(() => {
    instances.splice(0, instances.length);
  });

  it('marks element visible when intersecting', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock as unknown as typeof IntersectionObserver);
    render(
      <AnimateOnScroll>
        <span>child</span>
      </AnimateOnScroll>,
    );
    const host = screen.getByText('child').parentElement as HTMLElement;
    expect(host.getAttribute('data-animate')).toBe('');
    instances[0]!.trigger(true);
    expect(host.getAttribute('data-animate')).toBe('visible');
  });

  it('disconnects observer on unmount', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock as unknown as typeof IntersectionObserver);
    const { unmount } = render(
      <AnimateOnScroll>
        <span>child</span>
      </AnimateOnScroll>,
    );
    const observer = instances[0]!;
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });
});
