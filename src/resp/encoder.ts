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

if (Array.isArray(value)) {
  let result = `*${value.length}\r\n`;

  for (const item of value) {
    result += `$${Buffer.byteLength(item)}\r\n${item}\r\n`;
  }

  return Buffer.from(result);
}


  throw new Error("Unsupported RESP encode");
}
