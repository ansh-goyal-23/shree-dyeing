// In-memory draft cache for create forms. Persists across route changes
// during the same SPA session without touching sessionStorage/localStorage.
const store = new Map<string, unknown>();

export const getDraft = <T,>(key: string): T | undefined => store.get(key) as T | undefined;
export const setDraft = <T,>(key: string, value: T): void => { store.set(key, value); };
export const clearDraft = (key: string): void => { store.delete(key); };
