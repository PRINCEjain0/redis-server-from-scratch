import { Socket } from "net";
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

let masterOffset = 0;
let replicaClients: ReplicaClient[] = [];
let replicationBacklog: BacklogEntry[] = [];

export function registerReplica(socket: Socket, replicaOffset: number) {
  replicaClients.push({
    socket,
    offset: replicaOffset,
  });

  const replica = replicaClients[replicaClients.length - 1];

  for (const entry of replicationBacklog) {
    if (entry.end > replicaOffset) {
      socket.write(entry.data);
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

    for (const replica of replicaClients) {
      replica.socket.write(buf);
      replica.offset += buf.length;
    }
  }
}

export function removeReplicaForSocket(socket: Socket) {
  replicaClients = replicaClients.filter((r) => r.socket !== socket);
}

