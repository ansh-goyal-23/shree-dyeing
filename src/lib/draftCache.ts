// Draft cache for create forms.
// - Reads are synchronous from an in-memory mirror (zero cost on mount).
// - Writes update memory immediately and persist to sessionStorage
//   debounced (~400ms after last change) so typing stays smooth, but
//   the draft survives a tab discard / reload by Chrome.

const memory = new Map<string, unknown>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 400;

const storageKey = (key: string) => `draft:${key}`;

const hydrate = (key: string): unknown => {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (raw) {
      const parsed = JSON.parse(raw);
      memory.set(key, parsed);
      return parsed;
    }
  } catch {}
  return undefined;
};

export const getDraft = <T,>(key: string): T | undefined => hydrate(key) as T | undefined;

export const setDraft = <T,>(key: string, value: T): void => {
  memory.set(key, value);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    try { sessionStorage.setItem(storageKey(key), JSON.stringify(value)); } catch {}
    timers.delete(key);
  }, DEBOUNCE_MS);
  timers.set(key, t);
};

export const clearDraft = (key: string): void => {
  memory.delete(key);
  const existing = timers.get(key);
  if (existing) { clearTimeout(existing); timers.delete(key); }
  try { sessionStorage.removeItem(storageKey(key)); } catch {}
};
