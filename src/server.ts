import * as net from "net";
import { Socket } from "net";
import { decodeRESP } from "./resp/decoder";
import { encodeRESP } from "./resp/encoder";
import { setKey, getKey } from "./store/memory";

const port: number = 6379;

const server = net.createServer((socket: Socket) => {
  console.log("Client connected");

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunck: Buffer) => {
    buffer = Buffer.concat([buffer, chunck]);
    console.log("Received data:", buffer.toString("utf-8"));
    while (true) {
      const result = decodeRESP(buffer);
      if (!result) break;

      const [rawCommand, ...args] = result.value;
      const command = rawCommand.toUpperCase();


      console.log("Parsed command:", command);

      if (command === "PING") {
        const response = encodeRESP("PONG");
        socket.write(response);
      } else if (command === "SET") {
        const [key, value] = args;
        setKey(key, value);
        socket.write(encodeRESP("OK"));
      } else if (command === "GET") {
        const [key] = args;
        const value = getKey(key);

        if (value === null) {
          socket.write(encodeRESP(null));
        } else {
          socket.write(encodeRESP({ type: "bulk", value }));
        }
      } else if (command === "COMMAND") {
        socket.write(encodeRESP({ type: "bulk", value: "" }));
      }

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

server.listen(6379, () => {
  console.log("Server is listening on port 6379");
});
