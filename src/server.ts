import * as net from "net";
import { Socket } from "net";
import { decodeRESP } from "./resp/decoder";
import { encodeRESP } from "./resp/encoder";
import { store, expiryKeys } from "./store/memory";
import { executeCommand } from "./command/execute";
import { initAOF, appendToAOF, loadAOF } from "./persistence/aof";
import { connectToMaster } from "./replication/replica";

let port: number = 6379;

const args = process.argv;

let isReplica = false;
let masterHost: string | null = null;
let masterPort: number | null = null;

if (args.includes("--replica")) {
  const replicaIndex = args.indexOf("--replica");
  if (replicaIndex + 1 < args.length) {
    masterHost = args[replicaIndex + 1];
  }
  if (replicaIndex + 2 < args.length) {
    masterPort = parseInt(args[replicaIndex + 2]);
  }

  if (masterHost && masterPort) {
    isReplica = true;
  }
}

const portIndex = args.indexOf("--port");

if (portIndex !== -1 && portIndex + 1 < args.length) {
  port = parseInt(args[portIndex + 1], 10);
}


let replicaSocket: Socket[] = [];

loadAOF();
initAOF();

if (isReplica && masterHost && masterPort) {
  connectToMaster(masterHost, masterPort);
}

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

      if (command === "REPLICA") {
        replicaSocket.push(socket);

        socket.write(encodeRESP({ type: "status", value: "OK" }));

        buffer = buffer.slice(result.bytesConsumed);
        continue;
      }

      const response = executeCommand(command, args);

      if (isReplica && response.isWrite) {
        socket.write(
          encodeRESP({
            type: "error",
            value: "READONLY You can't write against a read only replica.",
          }),
        );

        buffer = buffer.slice(result.bytesConsumed);
        continue;
      }
      const rawBuffer = buffer.slice(0, result.bytesConsumed);
      if (response.isWrite) {
        appendToAOF(rawBuffer);
        for (const replica of replicaSocket) {
          replica.write(rawBuffer);
        }
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

server.listen(port, () => {
  console.log("Server is listening on port 6379");
});
