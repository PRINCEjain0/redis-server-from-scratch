import {
  setKey,
  getKey,
  ttlKey,
  deleteKey,
  existsKey,
  dbSize,
  getAllKeys,
} from "../store/memory";

export type ExecutionResult = {
  response: any;
  isWrite: boolean;
};

export function executeCommand(command: string, args: string[]) {
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

      if (option === "EX" && ttl !== undefined) {
        setKey(key, value, parseInt(ttl, 10));
      } else {
        setKey(key, value);
      }

      return { response: { type: "status", value: "OK" }, isWrite: true };
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
      const value = getKey(key);

      if (value === null) return { response: null, isWrite: false };

      return { response: { type: "bulk", value }, isWrite: false };
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
