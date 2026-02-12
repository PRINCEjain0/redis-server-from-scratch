import * as net from "net";
import { Socket } from "net";
import { decodeRESP } from "../resp/decoder";
import { encodeRESP } from "../resp/encoder";
import { executeCommand } from "../command/execute";
import { appendToAOF } from "../persistence/aof";

export function connectToMaster(masterHost: string, masterPort: number) {
  const socket = net.createConnection(masterPort, masterHost, () => {
    console.log("Connected to master");

    socket.write("*1\r\n$7\r\nREPLICA\r\n");
  });

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const result = decodeRESP(buffer);
      if (!result) break;

      const [rawCommand, ...args] = result.value;
      const command = rawCommand.toUpperCase();
      const response = executeCommand(command, args);

      if (response.isWrite) {
        const rawBuffer = buffer.slice(0, result.bytesConsumed);
        appendToAOF(rawBuffer);
      }

      buffer = buffer.slice(result.bytesConsumed);
    }
  });
}
