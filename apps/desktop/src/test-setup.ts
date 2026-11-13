import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Renderer tests opt into jsdom with `// @vitest-environment jsdom`; main/worker tests stay in node.
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO;
  Element.prototype.scrollIntoView ??= () => {};
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
}
