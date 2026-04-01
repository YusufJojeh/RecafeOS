import '@testing-library/jest-dom/vitest';

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom does not implement IntersectionObserver used by AnimateOnScroll.
if (!('IntersectionObserver' in globalThis)) {
  // @ts-expect-error test runtime shim
  globalThis.IntersectionObserver = MockIntersectionObserver;
}
