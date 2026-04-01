import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';
import 'fake-indexeddb/auto';

expect.extend(matchers);

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
