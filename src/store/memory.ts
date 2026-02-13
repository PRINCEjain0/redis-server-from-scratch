type redisValue =
  | {
      type: "string";
      value: string;
    }
  | {
      type: "list";
      value: string[];
    }
  | { type: "hash"; value: Map<string, string> };

interface StoredValue {
  data: redisValue;
  expiresAt: number | null;
}

export const store = new Map<string, StoredValue>();
export const expiryKeys = new Set<string>();

function isExpired(entry: StoredValue) {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt;
}

export function setKey(key: string, value: string, ttlSeconds?: number) {
  const expiresAt =
    ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : null;

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
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value",
    );
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
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value",
    );
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
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value",
    );
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
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value",
    );
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
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value",
    );
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
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value",
    );
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
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value",
    );
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


export function hset(key: string, field: string, value: string): number {
  let entry = store.get(key);

  if (entry && isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
    entry = undefined;
  }

  if (!entry) {
    entry = {
      data: { type: "hash", value: new Map() },
      expiresAt: null,
    };
    store.set(key, entry);
  }

  if (entry.data.type !== "hash") {
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value"
    );
  }

  const isNewField = !entry.data.value.has(field);

  entry.data.value.set(field, value);

  return isNewField ? 1 : 0;
}


export function hget(key: string, field: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
    return null;
  }

  if (entry.data.type !== "hash") {
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value"
    );
  }

  return entry.data.value.get(field) ?? null;
}

export function hgetall(key: string): string[] {
  const entry = store.get(key);
  if (!entry) return [];

  if (isExpired(entry)) {
    store.delete(key);
    expiryKeys.delete(key);
    return [];
  }

  if (entry.data.type !== "hash") {
    throw new Error(
      "WRONGTYPE Operation against a key holding the wrong kind of value"
    );
  }

  const result: string[] = [];

  for (const [field, value] of entry.data.value.entries()) {
    result.push(field, value);
  }

  return result;
}

export function expireKey(key: string, ttlSeconds: number): number {
  const entry = store.get(key);
  if (!entry) return 0;

  const expiresAt = Date.now() + ttlSeconds * 1000;

  entry.expiresAt = expiresAt;
  expiryKeys.add(key);

  return 1;
}

export function setBoolean(key: string, value: boolean): void {
  setKey(key, value ? "1" : "0");
}

export function getBoolean(key: string): boolean | null {
  const value = getKey(key);
  if (value === null) return null;

  if (value !== "0" && value !== "1") {
    throw new Error("WRONGTYPE Operation against a key holding non-boolean value");
  }

  return value === "1";
}

