/**
 * Run: npm test (or npx ts-node scripts/test-commands.ts)
 * Start server first: npm run start (or npx ts-node src/server.ts --port 6379)
 */
import * as net from "net";
import { encodeCommand } from "../src/resp/encoder";
import { readRESPResponse, isError } from "./read-response";

const PORT = 6379;
const HOST = "127.0.0.1";

function sendCommand(
  socket: net.Socket,
  parts: string[]
): Promise<string | number | null | string[]> {
  return new Promise((resolve, reject) => {
    const buf = encodeCommand(parts);
    let data = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      data = Buffer.concat([data, chunk]);
      const result = readRESPResponse(data);
      if (result) {
        socket.removeListener("data", onData);
        socket.removeListener("error", onError);
        resolve(result.value);
      }
    };
    const onError = (err: Error) => {
      socket.removeListener("data", onData);
      reject(err);
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.write(buf);
  });
}

async function runTests() {
  const socket = net.createConnection(PORT, HOST);
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => resolve());
    socket.on("error", (err: Error) => {
      console.error(
        "Cannot connect to server at " + HOST + ":" + PORT + ". Start it with: npm run start"
      );
      reject(err);
    });
  });

  let passed = 0;
  let failed = 0;

  function ok(cond: boolean, msg: string) {
    if (cond) {
      passed++;
      console.log("  OK:", msg);
    } else {
      failed++;
      console.log("  FAIL:", msg);
    }
  }

  async function cmd(parts: string[]): Promise<string | number | null | string[]> {
    return sendCommand(socket, parts);
  }

  console.log("\n=== PING ===");
  ok((await cmd(["PING"])) === "PONG", "PING -> PONG");

  console.log("\n=== SET / GET ===");
  const setResp = await cmd(["SET", "k1", "v1"]);
  ok(setResp === "OK" || setResp === "ok", "SET returns OK");
  const getK1 = await cmd(["GET", "k1"]);
  ok(getK1 === "v1" || String(getK1) === "v1", "GET k1 -> v1");
  ok((await cmd(["GET", "nonexistent"])) === null, "GET nonexistent -> null");
  ok(isError(await cmd(["SET", "x"])), "SET with 1 arg -> error");
  ok(isError(await cmd(["GET"])), "GET with 0 args -> error");
  ok(isError(await cmd(["GET", "a", "b"])), "GET with 2 args -> error");

  console.log("\n=== SET EX / TTL ===");
  await cmd(["SET", "tk", "tv", "EX", "10"]);
  const ttl = await cmd(["GET", "tk"]);
  ok(ttl === "tv", "SET EX then GET");
  const ttlVal = await cmd(["TTL", "tk"]);
  ok(
    typeof ttlVal === "number" && (ttlVal as number) > 0 && (ttlVal as number) <= 10,
    "TTL tk in range"
  );
  ok(isError(await cmd(["TTL"])), "TTL no arg -> error");

  console.log("\n=== DEL / EXISTS ===");
  await cmd(["SET", "d1", "x"]);
  ok(Number(await cmd(["DEL", "d1"])) === 1, "DEL existing -> 1");
  ok(Number(await cmd(["DEL", "d1"])) === 0, "DEL missing -> 0");
  ok(Number(await cmd(["EXISTS", "d1"])) === 0, "EXISTS missing -> 0");
  await cmd(["SET", "d2", "y"]);
  ok(Number(await cmd(["EXISTS", "d2"])) === 1, "EXISTS existing -> 1");
  ok(isError(await cmd(["DEL"])), "DEL no arg -> error");

  console.log("\n=== EXPIRE ===");
  await cmd(["SET", "ek", "ev"]);
  ok(Number(await cmd(["EXPIRE", "ek", "60"])) === 1, "EXPIRE -> 1");
  ok(Number(await cmd(["EXPIRE", "nosuch", "60"])) === 0, "EXPIRE missing key -> 0");
  ok(isError(await cmd(["EXPIRE", "ek"])), "EXPIRE 1 arg -> error");

  console.log("\n=== LPUSH / RPUSH / LLEN / LRANGE ===");
  await cmd(["DEL", "list1"]);
  ok(Number(await cmd(["LPUSH", "list1", "a", "b", "c"])) === 3, "LPUSH 3 -> 3");
  ok(Number(await cmd(["LLEN", "list1"])) === 3, "LLEN -> 3");
  const lr = await cmd(["LRANGE", "list1", "0", "-1"]);
  ok(Array.isArray(lr) && lr.length === 3 && lr[0] === "c" && lr[2] === "a", "LRANGE 0 -1 order");
  ok(Number(await cmd(["RPUSH", "list1", "d"])) === 4, "RPUSH -> 4");
  ok(isError(await cmd(["LPUSH", "list1"])), "LPUSH 1 arg -> error");
  ok(isError(await cmd(["LRANGE", "list1", "0"])), "LRANGE 2 args -> error");

  console.log("\n=== LPOP / RPOP ===");
  await cmd(["DEL", "list2"]);
  await cmd(["LPUSH", "list2", "x", "y"]);
  ok((await cmd(["LPOP", "list2"])) === "y", "LPOP -> y");
  ok((await cmd(["LPOP", "list2"])) === "x", "LPOP -> x");
  ok((await cmd(["LPOP", "list2"])) === null, "LPOP empty -> null");
  await cmd(["RPUSH", "list2", "a", "b"]);
  ok((await cmd(["RPOP", "list2"])) === "b", "RPOP -> b");
  const multi = await cmd(["LPOP", "list2", "2"]);
  ok(Array.isArray(multi) && multi.length === 1 && multi[0] === "a", "LPOP count 2 -> [a]");
  ok(isError(await cmd(["LPOP"])), "LPOP no arg -> error");

  console.log("\n=== HSET / HGET / HGETALL ===");
  await cmd(["DEL", "h1"]);
  ok(Number(await cmd(["HSET", "h1", "f1", "v1"])) === 1, "HSET single -> 1");
  ok((await cmd(["HGET", "h1", "f1"])) === "v1", "HGET -> v1");
  ok(Number(await cmd(["HSET", "h1", "f1", "v1b"])) === 0, "HSET overwrite -> 0");
  ok((await cmd(["HGET", "h1", "f1"])) === "v1b", "HGET after overwrite");
  ok(Number(await cmd(["HSET", "h1", "name", "prince", "age", "22"])) === 2, "HSET multiple -> 2");
  const hall = await cmd(["HGETALL", "h1"]);
  ok(
    Array.isArray(hall) &&
      hall.length >= 4 &&
      hall.includes("name") &&
      hall.includes("prince") &&
      hall.includes("age") &&
      hall.includes("22"),
    "HGETALL has name, prince, age, 22"
  );
  ok((await cmd(["HGET", "h1", "missing"])) === null, "HGET missing field -> null");
  ok((await cmd(["HGET", "nosuch", "f"])) === null, "HGET missing key -> null");
  ok(isError(await cmd(["HSET", "h1", "a"])), "HSET odd args -> error");
  ok(isError(await cmd(["HGET", "h1"])), "HGET 1 arg -> error");

  console.log("\n=== WRONGTYPE ===");
  await cmd(["SET", "strkey", "hello"]);
  ok(isError(await cmd(["LPUSH", "strkey", "x"])), "LPUSH on string -> WRONGTYPE");
  ok(isError(await cmd(["HGET", "strkey", "f"])), "HGET on string -> WRONGTYPE");
  await cmd(["DEL", "strkey"]);

  console.log("\n=== DBSIZE / KEYS ===");
  const sizeBefore = Number(await cmd(["DBSIZE"]));
  await cmd(["SET", "keys_a", "1"]);
  await cmd(["SET", "keys_b", "2"]);
  const sizeAfter = Number(await cmd(["DBSIZE"]));
  ok(sizeAfter === sizeBefore + 2, "DBSIZE +2 after two SETs");
  const keysRaw = await cmd(["KEYS", "*"]);
  const keys = Array.isArray(keysRaw) ? keysRaw : [];
  ok(keys.includes("keys_a") && keys.includes("keys_b"), "KEYS * contains keys_a, keys_b");
  await cmd(["DEL", "keys_a"]);
  await cmd(["DEL", "keys_b"]);
  ok(isError(await cmd(["KEYS", "x"])), "KEYS x (not *) -> error");

  console.log("\n=== INFO / COMMAND ===");
  const info = await cmd(["INFO"]);
  ok(typeof info === "string" && info.includes("redis_version"), "INFO contains redis_version");
  ok((await cmd(["COMMAND"])) !== undefined, "COMMAND returns");

  console.log("\n=== Unknown command ===");
  ok(isError(await cmd(["NOTACOMMAND", "x"])), "Unknown command -> ERR");

  socket.destroy();
  console.log("\n---");
  console.log("Passed:", passed, "Failed:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
