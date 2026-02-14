export type RESPParseResult =
  | { value: any; bytesConsumed: number }
  | null;

export function decodeRESP(buffer: Buffer): RESPParseResult {
  if (buffer.length === 0) return null;

  const firstByte = buffer[0];

  if (firstByte === 42) { 
    return parseArray(buffer);
  }

  throw new Error("Unsupported RESP type");
}


function parseArray(buffer: Buffer): RESPParseResult {
  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd === -1) return null;

  const count = parseInt(
    buffer.slice(1, lineEnd).toString(),
    10
  );
  if (Number.isNaN(count) || count < 0) return null;

  let offset = lineEnd + 2;
  const items: any[] = [];

  for (let i = 0; i < count; i++) {
    const result = parseBulkString(buffer.slice(offset));
    if (!result) return null;

    items.push(result.value);
    offset += result.bytesConsumed;
  }

  return {
    value: items,
    bytesConsumed: offset,
  };
}

function parseBulkString(buffer: Buffer): RESPParseResult {
  if (buffer[0] !== 36) { 
    throw new Error("Expected bulk string");
  }

  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd === -1) return null;

  const length = parseInt(
    buffer.slice(1, lineEnd).toString(),
    10
  );
  if (Number.isNaN(length) || length < 0) return null;

  const start = lineEnd + 2;
  const end = start + length;

  if (buffer.length < end + 2) return null;

  const value = buffer.slice(start, end).toString();

  return {
    value,
    bytesConsumed: end + 2, 
  };
}
