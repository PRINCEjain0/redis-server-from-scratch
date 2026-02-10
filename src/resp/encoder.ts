export function encodeRESP(value: any): Buffer {
  if (typeof value === "string") {
    return Buffer.from(`+${value}\r\n`);
  }

  throw new Error("Unsupported RESP type");
}
