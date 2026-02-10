import * as net from "net";
import { Socket } from "net";
import { decodeRESP } from "./resp/decoder";
import { encodeRESP } from "./resp/encoder";
import { setKey, getKey, ttlKey, store, expiryKeys } from "./store/memory";

const port: number = 6379;

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

      if (command === "PING") {
        const response = encodeRESP({ type: "status", value: "PONG" });
        socket.write(response);
      } else if (command === "SET") {
        if (args.length < 2) {
          socket.write(
            encodeRESP({
              type: "error",
              value: "ERR wrong number of arguments for 'set' command",
            }),
          );
          buffer = buffer.slice(result.bytesConsumed);
          continue;
        }
        const [key, value, option, ttl] = args;

        if (option === "EX" && ttl !== undefined) {
          setKey(key, value, parseInt(ttl, 10));
        } else {
          setKey(key, value);
        }

        socket.write(encodeRESP({ type: "status", value: "OK" }));
      } else if (command === "GET") {
        if (args.length !== 1) {
          socket.write(
            encodeRESP({
              type: "error",
              value: "ERR wrong number of arguments for 'get' command",
            }),
          );
          buffer = buffer.slice(result.bytesConsumed);
          continue;
        }
        const [key] = args;
        const value = getKey(key);

        if (value === null) {
          socket.write(encodeRESP(null));
        } else {
          socket.write(encodeRESP({ type: "bulk", value }));
        }
      } else if (command === "COMMAND") {
        socket.write(encodeRESP({ type: "bulk", value: "" }));
      } else if (command === "TTL") {
        if (args.length !== 1) {
          socket.write(
            encodeRESP({
              type: "error",
              value: "ERR wrong number of arguments for 'ttl' command",
            }),
          );
          buffer = buffer.slice(result.bytesConsumed);
          continue;
        }
        const [key] = args;
        const ttl = ttlKey(key);
        socket.write(encodeRESP({ type: "integer", value: ttl }));
      } else if (command === "INFO") {
        socket.write(
          encodeRESP({
            type: "bulk",
            value: "# Server\r\nredis_version:0.0.1\r\n",
          }),
        );
      }else{
        socket.write(
            encodeRESP({
              type: "error",
              value: "ERR unknown command",
            }),
          );
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
