type StoredValue = {
  value: string;
  expiresAt: number | null;
};

export const store = new Map<string, StoredValue>();
export const expiryKeys = new Set<string>();

function isExpired(entry: StoredValue) {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt;
}

export function setKey(
  key: string,
  value: string,
  ttlSeconds?: number
) {
  const expiresAt =
    ttlSeconds !== undefined
      ? Date.now() + ttlSeconds * 1000
      : null;

  store.set(key, { value, expiresAt });

  if (expiresAt !== null) {
    expiryKeys.add(key);
  } else {
    expiryKeys.delete(key);
  }
}

export function getKey(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
    return null;
  }

  return entry.value;
}

export function ttlKey(key: string): number {
  const entry = store.get(key);
  if (!entry) return -2;

  if (entry.expiresAt === null) return -1;

  const ttlMs = entry.expiresAt - Date.now();
  if (ttlMs <= 0) {
    store.delete(key);
    expiryKeys.delete(key);
    return -2;
  }

  return Math.ceil(ttlMs / 1000);
}
