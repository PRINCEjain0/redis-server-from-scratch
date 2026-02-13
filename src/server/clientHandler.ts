import { Socket } from "net";
import { decodeRESP } from "../resp/decoder";
import { encodeRESP } from "../resp/encoder";
import { executeCommand } from "../command/execute";
import {
  registerReplica,
  replicateAndPersistBuffers,
  removeReplicaForSocket,
} from "../replication/master";

function processClientBuffer(
  socket: Socket,
  initialBuffer: any,
  isReplica: boolean,
) {
  let buffer = initialBuffer;

  while (true) {
    const result = decodeRESP(buffer);
   
    if (!result) break;
    console.log(result);
    const [rawCommand, ...args] = result.value;
    const command = rawCommand.toUpperCase();

    console.log("Parsed command:", command);

    if (command === "REPLICA") {
      const replicaOffset = args[0] ? parseInt(args[0], 10) : 0;
      registerReplica(socket, replicaOffset);

      buffer = buffer.slice(result.bytesConsumed);
      continue;
    }

    const rawBuffer = buffer.slice(0, result.bytesConsumed);
    const response = executeCommand(command, args, rawBuffer);

    if (isReplica && response.aofBuffer) {
      socket.write(
        encodeRESP({
          type: "error",
          value: "READONLY You can't write against a read only replica.",
        }),
      );

      buffer = buffer.slice(result.bytesConsumed);
      continue;
    }

    if (response.aofBuffer) {
      replicateAndPersistBuffers(response.aofBuffer);
    }

    console.log("Execution result:", response);
    socket.write(encodeRESP(response.response));

    buffer = buffer.slice(result.bytesConsumed);
  }

  return buffer;
}

export function handleClientConnection(socket: Socket, isReplica: boolean) {
  console.log("Client connected");
  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    console.log("Received data:", buffer.toString());
    buffer = processClientBuffer(socket, buffer, isReplica);
  });

  socket.on("end", () => {
    console.log("Client disconnected");
    removeReplicaForSocket(socket);
  });

  socket.on("error", (err: Error) => {
    console.error("Socket error:", err);
    removeReplicaForSocket(socket);
  });
}

