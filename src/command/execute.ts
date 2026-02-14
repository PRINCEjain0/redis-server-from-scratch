import {
  setKey,
  getKey,
  ttlKey,
  deleteKey,
  existsKey,
  dbSize,
  getAllKeys,
  lpush,
  rpush,
  llen,
  expiryKeys,
  store,
  lpop,
  rpop,
  lrange,
  hset,
  hget,
  hgetall,
  expireKey,
} from "../store/memory";

import { encodeCommand } from "../resp/encoder";

export interface ExecutionResult {
  response: any;
  isWrite: boolean;
  aofBuffer?: Buffer[];
}

type CommandHandler = (args: string[], rawBuffer: Buffer) => ExecutionResult;

function errorResult(message: string, isWrite = false): ExecutionResult {
  return {
    response: { type: "error", value: message },
    isWrite,
  };
}

function integerResult(
  value: number,
  isWrite = false,
  aofBuffer?: Buffer[],
): ExecutionResult {
  return {
    response: { type: "integer", value },
    isWrite,
    aofBuffer,
  };
}

function bulkOrNullResult(
  value: string | null,
  isWrite = false,
): ExecutionResult {
  if (value === null) {
    return { response: null, isWrite };
  }

  return { response: { type: "bulk", value }, isWrite };
}

const handlePing: CommandHandler = () => ({
  response: { type: "status", value: "PONG" },
  isWrite: false,
});

const handleSet: CommandHandler = (args) => {
  if (args.length < 2 || args.length > 4) {
    return errorResult("ERR wrong number of arguments for 'set' command", true);
  }

  const [key, value, option, ttl] = args;
  let expiresAt: number | null = null;

  if (option === "EX" && ttl !== undefined) {
    const ttlSeconds = parseInt(ttl, 10);
    if(isNaN(ttlSeconds)){
      return errorResult("ERR ttl value is not an integer or out of range", false);
    }
    expiresAt = Date.now() + ttlSeconds * 1000;
    setKey(key, value, ttlSeconds);
  } else if((option ===  "EX" && ttl === undefined) || (option !== "EX")){
    return errorResult("ERR syntax error", false);
  } else{
    setKey(key, value);
  }
  return { response: { type: "status", value: "OK" }, isWrite: true };
};

const handleGet: CommandHandler = (args) => {
  if (args.length !== 1) {
    return errorResult(
      "ERR wrong number of arguments for 'get' command",
      false,
    );
  }

  const [key] = args;

  try {
    const value = getKey(key);
    return bulkOrNullResult(value);
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleDel: CommandHandler = (args, rawBuffer) => {
  if (args.length !== 1) {
    return errorResult(
      "ERR wrong number of arguments for 'del' command",
      false,
    );
  }

  const deleted = deleteKey(args[0]);
  return integerResult(deleted, deleted === 1, deleted === 1 ? [rawBuffer] : undefined);
};

const handleExists: CommandHandler = (args) => {
  if (args.length !== 1) {
    return errorResult(
      "ERR wrong number of arguments for 'exists' command",
      false,
    );
  }

  return integerResult(existsKey(args[0]));
};

const handleLpush: CommandHandler = (args, rawBuffer) => {
  if (args.length < 2) {
    return errorResult(
      "ERR wrong number of arguments for 'lpush' command",
      false,
    );
  }

  const [key, ...values] = args;

  try {
    const len = lpush(key, values);
    return integerResult(len, true, [rawBuffer]);
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleRpush: CommandHandler = (args, rawBuffer) => {
  if (args.length < 2) {
    return errorResult(
      "ERR wrong number of arguments for 'rpush' command",
      false,
    );
  }

  const [key, ...values] = args;

  try {
    const len = rpush(key, values);
    return integerResult(len, true, [rawBuffer]);
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleLlen: CommandHandler = (args) => {
  if (args.length !== 1) {
    return errorResult(
      "ERR wrong number of arguments for 'llen' command",
      false,
    );
  }

  const [key] = args;
  try {
    const len = llen(key);
    return integerResult(len);
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleLpop: CommandHandler = (args, rawBuffer) => {
  if (args.length < 1 || args.length > 2) {
    return errorResult("ERR wrong number of arguments", false);
  }

  const key = args[0];
  const count = args[1] ? parseInt(args[1], 10) : undefined;

  try {
    const result = lpop(key, count);

    if (!result || result.length === 0) {
      return { response: null, isWrite: false };
    }

    return {
      response: !count
        ? { type: "bulk", value: result[0] }
        : result.map((v) => ({ type: "bulk", value: v })),
      isWrite: true,
      aofBuffer: [rawBuffer],
    };
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleRpop: CommandHandler = (args, rawBuffer) => {
  if (args.length < 1 || args.length > 2) {
    return errorResult("ERR wrong number of arguments", false);
  }

  const key = args[0];
  const count = args[1] ? parseInt(args[1], 10) : undefined;

  try {
    const result = rpop(key, count);

    if (!result || result.length === 0) {
      return { response: null, isWrite: false };
    }

    return {
      response: !count
        ? { type: "bulk", value: result[0] }
        : result.map((v) => ({ type: "bulk", value: v })),
      isWrite: true,
      aofBuffer: [rawBuffer],
    };
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleLrange: CommandHandler = (args) => {
  if (args.length !== 3) {
    return errorResult("ERR wrong number of arguments", false);
  }

  try {
    const [key, startStr, stopStr] = args;
    const result = lrange(key, parseInt(startStr), parseInt(stopStr));

    return {
      response: result.map((v) => ({ type: "bulk", value: v })),
      isWrite: false,
    };
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handlePexpireAt: CommandHandler = (args, rawBuffer) => {
  if (args.length !== 2) {
    return errorResult(
      "ERR wrong number of arguments for 'pexpireat' command",
      false,
    );
  }

  const [key, timestampStr] = args;
  const timestamp = parseInt(timestampStr, 10);

  const entry = store.get(key);
  if (!entry) {
    return integerResult(0);
  }

  entry.expiresAt = timestamp;
  expiryKeys.add(key);

  return integerResult(1, true, [rawBuffer]);
};

const handleExpire: CommandHandler = (args) => {
  if (args.length !== 2) {
    return errorResult("ERR wrong number of arguments", false);
  }

  const [key, secondsStr] = args;
  const seconds = parseInt(secondsStr, 10);

  const result = expireKey(key, seconds);

  if (result === 1) {
    const expiresAt = Date.now() + seconds * 1000;

    const aofBuffers = [
      encodeCommand(["PEXPIREAT", key, expiresAt.toString()]),
    ];

    return {
      response: { type: "integer", value: 1 },
      isWrite: true,
      aofBuffer: aofBuffers,
    };
  }

  return integerResult(0);
};

const handleHset: CommandHandler = (args, rawBuffer) => {
  if (args.length !== 3) {
    return errorResult(
      "ERR wrong number of arguments for 'hset' command",
      false,
    );
  }

  const [key, field, value] = args;

  try {
    const result = hset(key, field, value);

    return integerResult(result, true, [rawBuffer]);
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleHget: CommandHandler = (args) => {
  if (args.length !== 2) {
    return errorResult(
      "ERR wrong number of arguments for 'hget' command",
      false,
    );
  }

  const [key, field] = args;

  try {
    const value = hget(key, field);
    return bulkOrNullResult(value);
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleHgetAll: CommandHandler = (args) => {
  if (args.length !== 1) {
    return errorResult(
      "ERR wrong number of arguments for 'hgetall' command",
      false,
    );
  }

  const [key] = args;

  try {
    const values = hgetall(key);

    return {
      response: values.map((v: string) => ({ type: "bulk", value: v })),
      isWrite: false,
    };
  } catch (err: any) {
    return errorResult(err.message, false);
  }
};

const handleDbsize: CommandHandler = () => ({
  response: { type: "integer", value: dbSize() },
  isWrite: false,
});

const handleTtl: CommandHandler = (args) => {
  if (args.length !== 1) {
    return errorResult(
      "ERR wrong number of arguments for 'ttl' command",
      false,
    );
  }

  const [key] = args;
  return integerResult(ttlKey(key));
};

const handleKeys: CommandHandler = (args) => {
  if (args.length !== 1 || args[0] !== "*") {
    return errorResult("ERR only KEYS * supported", false);
  }

  const keys = getAllKeys();

  return {
    response: keys.map((k) => ({ type: "bulk", value: k })),
    isWrite: false,
  };
};

const handleInfo: CommandHandler = () => ({
  response: {
    type: "bulk",
    value: "# Server\r\nredis_version:0.0.1\r\n",
  },
  isWrite: false,
});

const handleCommand: CommandHandler = () => ({
  response: { type: "bulk", value: "" },
  isWrite: false,
});

const commandHandlers: Record<string, CommandHandler> = {
  PING: handlePing,
  SET: handleSet,
  GET: handleGet,
  DEL: handleDel,
  EXISTS: handleExists,
  LPUSH: handleLpush,
  RPUSH: handleRpush,
  LLEN: handleLlen,
  LPOP: handleLpop,
  RPOP: handleRpop,
  LRANGE: handleLrange,
  PEXPIREAT: handlePexpireAt,
  EXPIRE: handleExpire,
  HSET: handleHset,
  HGET: handleHget,
  HGETALL: handleHgetAll,
  DBSIZE: handleDbsize,
  TTL: handleTtl,
  KEYS: handleKeys,
  INFO: handleInfo,
  COMMAND: handleCommand,
};

export function executeCommand(
  command: string,
  args: string[],
  rawBuffer: Buffer,
): ExecutionResult {
  const handler = commandHandlers[command];

  if (!handler) {
    return errorResult("ERR unknown command", false);
  }

  return handler(args, rawBuffer);
}
