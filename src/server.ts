import * as net from "net";
import { Socket } from "net";
import { decodeRESP } from "./resp/decoder";
import { encodeRESP } from "./resp/encoder";
import { store, expiryKeys } from "./store/memory";
import { executeCommand } from "./command/execute";
import { initAOF, appendToAOF, loadAOF } from "./persistence/aof";

const port: number = 6379;

loadAOF();
initAOF();

const server = net.createServer((socket: Socket) => {
  console.log("Client connected");

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunck: Buffer) => {
    buffer = Buffer.concat([buffer, chunck]);
    console.log("Received data:", buffer.toString());
    while (true) {
      const result = decodeRESP(buffer);
      console.log(result);
      if (!result) break;

      const [rawCommand, ...args] = result.value;
      const command = rawCommand.toUpperCase();

      console.log("Parsed command:", command);

      const response = executeCommand(command, args);

      const rawBuffer = buffer.slice(0, result.bytesConsumed)
      if(response.isWrite) {
        appendToAOF(rawBuffer);
      }
      console.log("Execution result:", response);
      socket.write(encodeRESP(response.response));

      buffer = buffer.slice(result.bytesConsumed);
    }
  });

  socket.on("end", () => {
    console.log("Client disconnected");
  });

  socket.on("error", (err: Error) => {
    console.error("Socket error:", err);
  });
});

setInterval(() => {
  const now = Date.now();
  let checked = 0;
  const MAX_SAMPLES = 20;

  for (const key of expiryKeys) {
    if (checked >= MAX_SAMPLES) break;
    checked++;

    const entry = store.get(key);
    if (!entry) {
      expiryKeys.delete(key);
      continue;
    }

    if (entry.expiresAt !== null && now > entry.expiresAt) {
      store.delete(key);
      expiryKeys.delete(key);
    }
  }
}, 1000);

server.listen(6379, () => {
  console.log("Server is listening on port 6379");
});
