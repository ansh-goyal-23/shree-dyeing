// Draft cache disabled — no persistence, no in-memory storage.
// Forms reset to defaults whenever the component unmounts.
export const getDraft = <T,>(_key: string): T | undefined => undefined;
export const setDraft = <T,>(_key: string, _value: T): void => {};
export const clearDraft = (_key: string): void => {};
