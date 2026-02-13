type redisValue = {
  type : "string",
  value : string,
} | {
  type : "list",
  value : string[],
}

interface StoredValue {
  data: redisValue;
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

  store.set(key, {
  data: { type: "string", value },
  expiresAt,
});

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

  if (entry.data.type !== "string") {
    throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
  }

  return entry.data.value;
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

export function deleteKey(key: string): number {
  if (!store.has(key)) return 0;

  store.delete(key);
  expiryKeys.delete(key);
  return 1;
}

export function existsKey(key: string): number {
  const entry = store.get(key);
  if (!entry) return 0;

  if (isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
    return 0;
  }

  return 1;
}


export function dbSize(): number {
  let count = 0;

  for (const [key, entry] of store.entries()) {
    if (isExpired(entry)) {
      store.delete(key);
      expiryKeys.delete(key);
      continue;
    }
    count++;
  }

  return count;
}


export function getAllKeys(): string[] {
  const keys: string[] = [];

  for (const [key, entry] of store.entries()) {
    if (isExpired(entry)) {
      store.delete(key);
      expiryKeys.delete(key);
      continue;
    }
    keys.push(key);
  }

  return keys;
}



export function lpush(key: string, values: string[]): number {
  const entry = store.get(key);

  if (entry && isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
  }

  let current = store.get(key);

  if (!current) {
    current = {
      data: { type: "list", value: [] },
      expiresAt: null,
    };
    store.set(key, current);
  }

  if (current.data.type !== "list") {
    throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
  }

  for (const v of values) {
    current.data.value.unshift(v);
  }

  return current.data.value.length;
}


export function rpush(key: string, values: string[]): number {
  const entry = store.get(key);

  if (entry && isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
  }

  let current = store.get(key);

  if (!current) {
    current = {
      data: { type: "list", value: [] },
      expiresAt: null,
    };
    store.set(key, current);
  }

  if (current.data.type !== "list") {
    throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
  }

  for (const v of values) {
    current.data.value.push(v);
  }

  return current.data.value.length;
}



export function llen(key: string): number {
  const entry = store.get(key);
  if (!entry) return 0;

  if (entry.data.type !== "list") {
    throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
  }

  return entry.data.value.length;
}

export function lpop(key: string, count?: number): string[] | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
    return null;
  }

  if (entry.data.type !== "list") {
    throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
  }

  const list = entry.data.value;

  if (list.length === 0) {
    store.delete(key);
    expiryKeys.delete(key);
    return null;
  }

  const popCount = count ?? 1;
  const result = list.splice(0, popCount);

  if (list.length === 0) {
    store.delete(key);
    expiryKeys.delete(key);
  }

  return result;
}




export function rpop(key: string, count?: number): string[] | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
    return null;
  }

  if (entry.data.type !== "list") {
    throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
  }

  const list = entry.data.value;

  if (list.length === 0) {
    store.delete(key);
    expiryKeys.delete(key);
    return null;
  }

  const popCount = count ?? 1;
  const result = list.splice(list.length - popCount, popCount);

  if (list.length === 0) {
    store.delete(key);
    expiryKeys.delete(key);
  }

  return result;
}



export function lrange(key: string, start: number, stop: number): string[] {
  const entry = store.get(key);
  if (!entry) return [];

  if (entry.data.type !== "list") {
    throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
  }

  const list = entry.data.value;
  const len = list.length;

  if (start < 0) start = len + start;
  if (stop < 0) stop = len + stop;

  start = Math.max(start, 0);
  stop = Math.min(stop, len - 1);

  if (start > stop || start >= len) return [];

  return list.slice(start, stop + 1);
}


