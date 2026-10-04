// Setup for vitest in Node 26+ environment
// In Node 26+, an experimental globalThis.localStorage shadows jsdom's window.localStorage.
const store = new Map();
const mockLocalStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (i) => Array.from(store.keys())[i] ?? null,
};

const resolvedStorage = (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.clear === 'function')
  ? window.localStorage
  : mockLocalStorage;

Object.defineProperty(globalThis, 'localStorage', {
  value: resolvedStorage,
  configurable: true,
  writable: true,
  enumerable: true
});
