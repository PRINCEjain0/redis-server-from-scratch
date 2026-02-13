import * as net from "net";
import * as path from "path";
import * as fs from "fs";

import { decodeRESP } from "../resp/decoder";
import { executeCommand } from "../command/execute";
import { appendToAOF } from "../persistence/aof";

export function connectToMaster(masterHost: string, masterPort: number) {
  const filePath = path.join(process.cwd(), "appendonly.aof");

  let replicaOffset = 0;

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    replicaOffset = stats.size;
  }

  const socket = net.createConnection(masterPort, masterHost, () => {
    console.log("Connected to master");

    const msg = `*2\r\n$7\r\nREPLICA\r\n$${replicaOffset.toString().length}\r\n${replicaOffset}\r\n`;
    socket.write(msg);
  });

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const result = decodeRESP(buffer);
      if (!result) break;

      const [rawCommand, ...args] = result.value;
      const command = rawCommand.toUpperCase();
      const rawBuffer = buffer.slice(0, result.bytesConsumed);
      const response = executeCommand(command, args, rawBuffer);
      replicaOffset += result.bytesConsumed;

      if (response.isWrite) {
        appendToAOF(rawBuffer);
      }

      buffer = buffer.slice(result.bytesConsumed);
    }
  });
}
