const store = new Map<string, string>();

export function setKey(key: string, value: string) {
  store.set(key, value);
}

export function getKey(key: string): string | null {
  return store.has(key) ? store.get(key)! : null;
}
