import * as net from "net";
import { Socket } from "net";
import { initAOF, loadAOF } from "./persistence/aof";
import { connectToMaster } from "./replication/replica";
import { parseArgs } from "./server/config";
import { handleClientConnection } from "./server/clientHandler";
import { startExpiryCleaner } from "./server/expiry";
import { initMasterReplication } from "./replication/master";

function bootstrap() {
  const { port, isReplica, masterHost, masterPort } = parseArgs(process.argv);

  loadAOF(port);
  initAOF(port);

  if (!isReplica) {
    initMasterReplication(port);
  }

  if (isReplica && masterHost && masterPort) {
    connectToMaster(masterHost, masterPort, port);
  }

  const server = net.createServer((socket: Socket) =>
    handleClientConnection(socket, isReplica),
  );

  startExpiryCleaner();

  server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
}

bootstrap();
