import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabVisible } from './use-tab-visible';

describe('useTabVisible', () => {
  let listeners: Record<string, EventListener[]>;

  beforeEach(() => {
    listeners = {};
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, cb: EventListenerOrEventListenerObject) => {
        listeners[type] = listeners[type] ?? [];
        listeners[type].push(cb as EventListener);
      },
    );
    vi.spyOn(document, 'removeEventListener').mockImplementation(
      (type: string, cb: EventListenerOrEventListenerObject) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter((l) => l !== cb);
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when document is visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useTabVisible());
    expect(result.current).toBe(true);
  });

  it('returns false when document is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useTabVisible());
    expect(result.current).toBe(false);
  });

  it('updates to false when tab becomes hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useTabVisible());
    expect(result.current).toBe(true);

    // Simulate tab hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    act(() => {
      listeners['visibilitychange']?.forEach((l) => l(new Event('visibilitychange')));
    });
    expect(result.current).toBe(false);
  });

  it('updates to true when tab becomes visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useTabVisible());
    expect(result.current).toBe(false);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    act(() => {
      listeners['visibilitychange']?.forEach((l) => l(new Event('visibilitychange')));
    });
    expect(result.current).toBe(true);
  });

  it('removes event listener on unmount', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    const { unmount } = renderHook(() => useTabVisible());
    expect(listeners['visibilitychange']?.length).toBeGreaterThan(0);
    unmount();
    expect(listeners['visibilitychange']?.length ?? 0).toBe(0);
  });
});
