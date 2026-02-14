/**
 * Read a single RESP value from buffer. Returns { value, bytesConsumed } or null if incomplete.
 */
export function readRESPResponse(
  buffer: Buffer
): { value: string | number | null | string[]; bytesConsumed: number } | null {
  if (buffer.length === 0) return null;
  const first = buffer[0];
  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd === -1) return null;

  if (first === 43) {
    return { value: buffer.slice(1, lineEnd).toString(), bytesConsumed: lineEnd + 2 };
  }
  if (first === 45) {
    return { value: buffer.slice(1, lineEnd).toString(), bytesConsumed: lineEnd + 2 };
  }
  if (first === 58) {
    const s = buffer.slice(1, lineEnd).toString();
    return { value: parseInt(s, 10), bytesConsumed: lineEnd + 2 };
  }
  if (first === 36) {
    const len = parseInt(buffer.slice(1, lineEnd).toString(), 10);
    if (len === -1) return { value: null, bytesConsumed: lineEnd + 2 };
    const start = lineEnd + 2;
    const end = start + len;
    if (buffer.length < end + 2) return null;
    const value = buffer.slice(start, end).toString();
    return { value, bytesConsumed: end + 2 };
  }
  if (first === 42) {
    const count = parseInt(buffer.slice(1, lineEnd).toString(), 10);
    if (count === -1) return { value: null, bytesConsumed: lineEnd + 2 };
    let offset = lineEnd + 2;
    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = readRESPResponse(buffer.slice(offset));
      if (!part) return null;
      offset += part.bytesConsumed;
      items.push(String(part.value));
    }
    return { value: items, bytesConsumed: offset };
  }
  return null;
}

export function isError(r: string | number | null | string[]): r is string {
  return (
    typeof r === "string" &&
    (r.startsWith("ERR") || r.startsWith("WRONGTYPE") || r.startsWith("READONLY"))
  );
}
