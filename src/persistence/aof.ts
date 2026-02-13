import * as fs from "fs";
import * as path from "path";
import { decodeRESP } from "../resp/decoder";
import { executeCommand } from "../command/execute";

let stream: fs.WriteStream | null = null;
let fd: number | null = null;
let lastFsync = Date.now();
let isReplaying = false;


export function initAOF() {
  const filePath = path.join(process.cwd(), "appendonly.aof");

  fd = fs.openSync(filePath, "a");
  stream = fs.createWriteStream(filePath, {
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

export function loadAOF() {
  const filePath = path.join(process.cwd(), "appendonly.aof");
  if (!fs.existsSync(filePath)) return;

  const data = fs.readFileSync(filePath);

  isReplaying = true;

  let buffer = data;
  while (true) {
    const result = decodeRESP(buffer);

    if (!result) break;

    const [rawCommand, ...args] = result.value;
    const command = rawCommand.toUpperCase();
    const  rawBuffer = buffer.slice(0, result.bytesConsumed);
    executeCommand(command, args, rawBuffer);

    buffer = buffer.slice(result.bytesConsumed);
  }

  isReplaying = false;
}
