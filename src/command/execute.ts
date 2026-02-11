import { setKey, getKey, ttlKey } from "../store/memory";

export function executeCommand(command: string, args: string[]) {
  switch (command) {

    case "PING":
      return { type: "status", value: "PONG" };

    case "SET": {
      if (args.length < 2) {
        return {
          type: "error",
          value: "ERR wrong number of arguments for 'set' command",
        };
      }

      const [key, value, option, ttl] = args;

      if (option === "EX" && ttl !== undefined) {
        setKey(key, value, parseInt(ttl, 10));
      } else {
        setKey(key, value);
      }

      return { type: "status", value: "OK" };
    }

    case "GET": {
      if (args.length !== 1) {
        return {
          type: "error",
          value: "ERR wrong number of arguments for 'get' command",
        };
      }

      const [key] = args;
      const value = getKey(key);

      if (value === null) return null;

      return { type: "bulk", value };
    }

    case "TTL": {
      if (args.length !== 1) {
        return {
          type: "error",
          value: "ERR wrong number of arguments for 'ttl' command",
        };
      }

      const [key] = args;
      return { type: "integer", value: ttlKey(key) };
    }

    case "INFO":
      return {
        type: "bulk",
        value: "# Server\r\nredis_version:0.0.1\r\n",
      };

    case "COMMAND":
      return { type: "bulk", value: "" };

    default:
      return {
        type: "error",
        value: "ERR unknown command",
      };
  }
}
