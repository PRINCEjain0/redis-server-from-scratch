
export interface ServerConfig {
  port: number;
  isReplica: boolean;
  masterHost: string | null;
  masterPort: number | null;
}

export function parseArgs(argv: string[]): ServerConfig {
  let port = 6379;
  let isReplica = false;
  let masterHost: string | null = null;
  let masterPort: number | null = null;

  const args = argv.slice(2);

  if (args.includes("--replica")) {
    const replicaIndex = args.indexOf("--replica");
    if (replicaIndex + 1 < args.length) {
      masterHost = args[replicaIndex + 1];
    }
    if (replicaIndex + 2 < args.length) {
      masterPort = parseInt(args[replicaIndex + 2], 10);
    }

    if (masterHost && masterPort) {
      isReplica = true;
    }
  }

  const portIndex = args.indexOf("--port");

  if (portIndex !== -1 && portIndex + 1 < args.length) {
    port = parseInt(args[portIndex + 1], 10);
  }

  return { port, isReplica, masterHost, masterPort };
}

