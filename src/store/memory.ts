type StoredValue = {
  value: string;
  expiresAt: number | null;
};

const store = new Map<string, StoredValue>();

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
}

export function getKey(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (isExpired(entry)) {
    store.delete(key);
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
    return -2;
  }

  return Math.ceil(ttlMs / 1000);
}
