export type RESPValue =
  | { type: "status"; value: string }
  | { type: "error"; value: string }
  | { type: "integer"; value: number }
  | { type: "bulk"; value: string }
  | null
  
export function encodeRESP(value: RESPValue): Buffer {
  if (value === null) {
    return Buffer.from("$-1\r\n");
  }

  if (Array.isArray(value)) {
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`*${value.length}\r\n`));

    for (const item of value) {
      parts.push(encodeRESP(item));
    }

    return Buffer.concat(parts);
  }

  switch (value.type) {
    case "status":
      return Buffer.from(`+${value.value}\r\n`);

    case "error":
      return Buffer.from(`-${value.value}\r\n`);

    case "integer":
      return Buffer.from(`:${value.value}\r\n`);

    case "bulk": {
      const str = value.value ?? "";
      const len = Buffer.byteLength(str);
      return Buffer.from(`$${len}\r\n${str}\r\n`);
    }

    default:
      throw new Error("Unsupported RESP type");
  }
}


export function encodeCommand(parts: string[]): Buffer {
  const len = parts.length;

  let resp = `*${len}\r\n`;

  for (const part of parts) {
    resp += `$${Buffer.byteLength(part)}\r\n${part}\r\n`;
  }

  return Buffer.from(resp);
}