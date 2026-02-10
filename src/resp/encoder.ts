export function encodeRESP(value: any): Buffer {
  if (typeof value === "string") {
    return Buffer.from(`+${value}\r\n`);
  }
  if (value === null) {
    return Buffer.from(`$-1\r\n`);
  }

   if (value !== null && typeof value === "object" && value.type === "bulk") {
    const str = value.value;
    return Buffer.from(`$${Buffer.byteLength(str)}\r\n${str}\r\n`);
  }

  throw new Error("Unsupported RESP type");
}
