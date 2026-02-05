import * as net from "net";

const PORT = 6379;

const client = net.createConnection({ port: PORT }, () => {
  console.log("Client connected to server");

  const pingCommand = "*1\r\n$4\r\nPING\r\n";
  client.write(pingCommand);
});

client.on("data", (data: Buffer) => {
  console.log("Server response:", data.toString("utf-8"));
});

client.on("end", () => {
  console.log("Disconnected from server");
});

client.on("error", (err: Error) => {
  console.error("Client error:", err.message);
});
