import { store, expiryKeys } from "../store/memory";

export function startExpiryCleaner() {
  setInterval(() => {
    const now = Date.now();
    let checked = 0;
    const MAX_SAMPLES = 20;

    for (const key of expiryKeys) {
      if (checked >= MAX_SAMPLES) break;
      checked++;

      const entry = store.get(key);
      if (!entry) {
        expiryKeys.delete(key);
        continue;
      }

      if (entry.expiresAt !== null && now > entry.expiresAt) {
        store.delete(key);
        expiryKeys.delete(key);
      }
    }
  }, 1000);
}

