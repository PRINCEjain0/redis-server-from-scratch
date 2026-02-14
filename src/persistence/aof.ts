import * as fs from "fs";
import * as path from "path";
import { decodeRESP } from "../resp/decoder";
import { executeCommand } from "../command/execute";

let stream: fs.WriteStream | null = null;
let fd: number | null = null;
let lastFsync = Date.now();
let isReplaying = false;
let aofPath: string = "";

function getAOFPath(port: number): string {
  return path.join(process.cwd(), `appendonly-${port}.aof`);
}

export function initAOF(port: number) {
  aofPath = getAOFPath(port);

  fd = fs.openSync(aofPath, "a");
  stream = fs.createWriteStream(aofPath, {
    flags: "a",
  });
}

export function appendToAOF(buffer: Buffer) {
  if (!stream || fd === null) return;

  stream.write(buffer);

  const now = Date.now();

  if (now - lastFsync >= 1000) {
    fs.fsyncSync(fd);
    lastFsync = now;
  }
}

export function loadAOF(port: number) {
  aofPath = getAOFPath(port);
  if (!fs.existsSync(aofPath)) return;

  const data = fs.readFileSync(aofPath);

  isReplaying = true;

  let buffer = data;
  while (true) {
    try {
      const result = decodeRESP(buffer);
      if (!result) break;

      const [rawCommand, ...args] = result.value;
      if (rawCommand == null || typeof rawCommand !== "string") break;
      const command = rawCommand.toUpperCase();
      const rawBuffer = buffer.slice(0, result.bytesConsumed);
      executeCommand(command, args, rawBuffer);

      buffer = buffer.slice(result.bytesConsumed);
    } catch (err) {
      console.error("AOF replay error:", err);
      break;
    }
  }

  isReplaying = false;
}

export function getAOFFilePath(): string {
  return aofPath;
}
