export function encodeRESP(value: any): Buffer {
  if (value?.type === "status") {
    return Buffer.from(`+${value.value}\r\n`);
  }

  if (value?.type === "bulk") {
    const str = value.value;
    return Buffer.from(`$${Buffer.byteLength(str)}\r\n${str}\r\n`);
  }

  if (value === null) {
    return Buffer.from(`$-1\r\n`);
  }

  if (value?.type === "integer") {
    return Buffer.from(`:${value.value}\r\n`);
  }

  if (value?.type === "error") {
  return Buffer.from(`-${value.value}\r\n`);
}

  throw new Error("Unsupported RESP encode");
}
