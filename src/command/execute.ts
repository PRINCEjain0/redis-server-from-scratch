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
  expireKey
} from "../store/memory";

import { encodeCommand } from "../resp/encoder";

export interface ExecutionResult {
  response: any;
  isWrite: boolean;
  aofBuffer?: Buffer[];
}

export function executeCommand(
  command: string,
  args: string[],
  rawBuffer: Buffer,
): ExecutionResult {
  switch (command) {
    case "PING":
      return { response: { type: "status", value: "PONG" }, isWrite: false };

    case "SET": {
      if (args.length < 2) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'set' command",
          },
          isWrite: true,
        };
      }

      const [key, value, option, ttl] = args;
      let expiresAt: number | null = null;

      if (option === "EX" && ttl !== undefined) {
        const ttlSeconds = parseInt(ttl, 10);
        expiresAt = Date.now() + ttlSeconds * 1000;
        setKey(key, value, ttlSeconds);
      } else {
        setKey(key, value);
      }

      let aofBuffer: Buffer[] = [];

      aofBuffer.push(encodeCommand(["SET", key, value]));

      if (expiresAt !== null) {
        aofBuffer.push(encodeCommand(["PEXPIREAT", key, expiresAt.toString()]));
      }

      return {
        response: { type: "status", value: "OK" },
        isWrite: true,
        aofBuffer: aofBuffer,
      };
    }

    case "GET": {
      if (args.length !== 1) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'get' command",
          },
          isWrite: false,
        };
      }

      const [key] = args;

      try {
        const value = getKey(key);

        if (value === null) return { response: null, isWrite: false };

        return { response: { type: "bulk", value }, isWrite: false };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "DEL": {
      if (args.length !== 1) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'del' command",
          },
          isWrite: false,
        };
      }

      const deleted = deleteKey(args[0]);

      return {
        response: { type: "integer", value: deleted },
        isWrite: deleted === 1,
        aofBuffer: deleted === 1 ? [rawBuffer] : undefined,
      };
    }

    case "EXISTS": {
      if (args.length !== 1) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'exists' command",
          },
          isWrite: false,
        };
      }

      return {
        response: { type: "integer", value: existsKey(args[0]) },
        isWrite: false,
      };
    }

    case "LPUSH": {
      if (args.length < 2) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'lpush' command",
          },
          isWrite: false,
        };
      }

      const [key, ...values] = args;

      try {
        const len = lpush(key, values);
        return {
          response: { type: "integer", value: len },
          isWrite: true,
          aofBuffer: [rawBuffer],
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "RPUSH": {
      if (args.length < 2) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'rpush' command",
          },
          isWrite: false,
        };
      }

      const [key, ...values] = args;

      try {
        const len = rpush(key, values);
        return {
          response: { type: "integer", value: len },
          isWrite: true,
          aofBuffer: [rawBuffer],
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "LLEN": {
      if (args.length !== 1) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'llen' command",
          },
          isWrite: false,
        };
      }

      const [key] = args;
      try {
        const len = llen(key);

        if (len == 0) {
          return {
            response: { type: "integer", value: 0 },
            isWrite: false,
          };
        }

        return {
          response: { type: "integer", value: len },
          isWrite: false,
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "LPOP": {
      if (args.length < 1 || args.length > 2) {
        return {
          response: { type: "error", value: "ERR wrong number of arguments" },
          isWrite: false,
        };
      }

      const key = args[0];
      const count = args[1] ? parseInt(args[1], 10) : undefined;

      try {
        const result = lpop(key, count);

        if (!result || result.length === 0) {
          return {
            response: null,
            isWrite: false,
          };
        }

        if (!count) {
          return {
            response: { type: "bulk", value: result[0] },
            isWrite: true,
            aofBuffer: [rawBuffer],
          };
        }

        return {
          response: result,
          isWrite: true,
          aofBuffer: [rawBuffer],
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "RPOP": {
      if (args.length < 1 || args.length > 2) {
        return {
          response: { type: "error", value: "ERR wrong number of arguments" },
          isWrite: false,
        };
      }

      const key = args[0];
      const count = args[1] ? parseInt(args[1], 10) : undefined;

      try {
        const result = rpop(key, count);

        if (!result || result.length === 0) {
          return {
            response: null,
            isWrite: false,
          };
        }

        if (!count) {
          return {
            response: { type: "bulk", value: result[0] },
            isWrite: true,
            aofBuffer: [rawBuffer],
          };
        }

        return {
          response: result,
          isWrite: true,
          aofBuffer: [rawBuffer],
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "LRANGE": {
      if (args.length !== 3) {
        return {
          response: { type: "error", value: "ERR wrong number of arguments" },
          isWrite: false,
        };
      }

      try {
        const [key, startStr, stopStr] = args;
        const result = lrange(key, parseInt(startStr), parseInt(stopStr));

        return {
          response: result,
          isWrite: false,
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "PEXPIREAT": {
      if (args.length !== 2) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'pexpireat' command",
          },
          isWrite: false,
        };
      }

      const [key, timestampStr] = args;
      const timestamp = parseInt(timestampStr, 10);

      const entry = store.get(key);
      if (!entry) {
        return {
          response: { type: "integer", value: 0 },
          isWrite: false,
        };
      }

      entry.expiresAt = timestamp;
      expiryKeys.add(key);

      return {
        response: { type: "integer", value: 1 },
        aofBuffer: [rawBuffer],
        isWrite: true,
      };
    }

    case "EXPIRE": {
      if (args.length !== 2) return {response: { type: "error", value: "ERR wrong number of arguments" }, isWrite: false  };

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

      return {
        response: { type: "integer", value: 0 },
        isWrite: false,
      };
    }

    case "HSET": {
      if (args.length !== 3) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'hset' command",
          },
          isWrite: false,
        };
      }

      const [key, field, value] = args;

      try {
        const result = hset(key, field, value);

        return {
          response: { type: "integer", value: result },
          isWrite: true,
          aofBuffer: [rawBuffer],
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "HGET": {
      if (args.length !== 2)
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'hget' command",
          },
          isWrite: false,
        };

      const [key, field] = args;

      try {
        const value = hget(key, field);

        if (value === null) return { response: null, isWrite: false };

        return {
          response: { type: "bulk", value },
          isWrite: false,
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "HGETALL": {
      if (args.length !== 1)
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'hgetall' command",
          },
          isWrite: false,
        };

      const [key] = args;

      try {
        const values = hgetall(key);

        return {
          response: values,
          isWrite: false,
        };
      } catch (err: any) {
        return {
          response: { type: "error", value: err.message },
          isWrite: false,
        };
      }
    }

    case "DBSIZE":
      return {
        response: { type: "integer", value: dbSize() },
        isWrite: false,
      };

    case "TTL": {
      if (args.length !== 1) {
        return {
          response: {
            type: "error",
            value: "ERR wrong number of arguments for 'ttl' command",
          },
          isWrite: false,
        };
      }

      const [key] = args;
      return {
        response: { type: "integer", value: ttlKey(key) },
        isWrite: false,
      };
    }

    case "KEYS": {
      if (args.length !== 1 || args[0] !== "*") {
        return {
          response: {
            type: "error",
            value: "ERR only KEYS * supported",
          },
          isWrite: false,
        };
      }

      return {
        response: getAllKeys(),
        isWrite: false,
      };
    }

    case "INFO":
      return {
        response: {
          type: "bulk",
          value: "# Server\r\nredis_version:0.0.1\r\n",
        },
        isWrite: false,
      };

    case "COMMAND":
      return { response: { type: "bulk", value: "" }, isWrite: false };

    default:
      return {
        response: { type: "error", value: "ERR unknown command" },
        isWrite: false,
      };
  }
}
