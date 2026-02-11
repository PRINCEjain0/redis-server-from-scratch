import * as fs from "fs";
import * as path from "path";
import { decodeRESP } from "../resp/decoder";
import { executeCommand } from "../command/execute";

let stream: fs.WriteStream | null = null;

export function initAOF() {
  stream = fs.createWriteStream(path.join(process.cwd(), "appendonly.aof"), {
    flags: "a",
  });
}

let isReplaying = false;

export function appendToAOF(buffer: Buffer) {
  if (!stream) return;

  if(isReplaying) return;

  stream.write(buffer);
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

    executeCommand(command, args);

    buffer = buffer.slice(result.bytesConsumed);
  }

  isReplaying = false;
}
