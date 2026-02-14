import { Socket } from "net";
import * as fs from "fs";
import * as path from "path";
import { appendToAOF } from "../persistence/aof";

interface ReplicaClient {
  socket: Socket;
  offset: number;
}

interface BacklogEntry {
  start: number;
  end: number;
  data: Buffer;
}

const MAX_BACKLOG_BYTES = 1024 * 1024;

let masterPort = 6379;
let masterOffset = 0;
let replicaClients: ReplicaClient[] = [];
let replicationBacklog: BacklogEntry[] = [];

export function initMasterReplication(port: number) {
  masterPort = port;
  const aofPath = path.join(process.cwd(), `appendonly-${port}.aof`);

  if (fs.existsSync(aofPath)) {
    const stats = fs.statSync(aofPath);
    masterOffset = stats.size;
  }
}

function writeToReplica(socket: Socket, data: Buffer): boolean {
  try {
    socket.write(data);
    return true;
  } catch {
    removeReplicaForSocket(socket);
    return false;
  }
}

function sendFullResync(socket: Socket): number {
  const filePath = path.join(process.cwd(), `appendonly-${masterPort}.aof`);

  if (!fs.existsSync(filePath)) return 0;
  try {
    const data = fs.readFileSync(filePath);
    writeToReplica(socket, data);
    return data.length;
  } catch (err) {
    console.error("Full resync error:", err);
    return 0;
  }
}

export function registerReplica(socket: Socket, replicaOffset: number) {
  const canIncremental =
    replicationBacklog.length > 0 &&
    replicaOffset >= replicationBacklog[0].start &&
    replicaOffset <= masterOffset;

  const initialOffset = canIncremental ? replicaOffset : sendFullResync(socket);

  replicaClients.push({
    socket,
    offset: initialOffset,
  });

  if (!canIncremental) return;

  const replica = replicaClients[replicaClients.length - 1];
  for (const entry of replicationBacklog) {
    if (entry.end > replicaOffset) {
      if (!writeToReplica(socket, entry.data)) return;
      replica.offset += entry.data.length;
    }
  }
}

export function replicateAndPersistBuffers(buffers: Buffer[]) {
  for (const buf of buffers) {
    appendToAOF(buf);

    const start = masterOffset;
    const end = masterOffset + buf.length;

    replicationBacklog.push({
      start,
      end,
      data: buf,
    });

    masterOffset = end;

    while (
      replicationBacklog.length > 0 &&
      masterOffset - replicationBacklog[0].start > MAX_BACKLOG_BYTES
    ) {
      replicationBacklog.shift();
    }

    const dead: Socket[] = [];
    for (const replica of replicaClients) {
      try {
        replica.socket.write(buf);
        replica.offset += buf.length;
      } catch {
        dead.push(replica.socket);
      }
    }
    replicaClients = replicaClients.filter((r) => !dead.includes(r.socket));
  }
}

export function removeReplicaForSocket(socket: Socket) {
  replicaClients = replicaClients.filter((r) => r.socket !== socket);
}

