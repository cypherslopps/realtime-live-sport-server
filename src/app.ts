import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8000 });

// Connection Event
wss.on("connection", (socket, request) => {
  const ip = request.socket.remoteAddress;
  console.log(ip);

  socket.on("message", (rawData) => {
    const message = rawData.toString();
    console.log({ rawData });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN)
        client.send(`Server broadcast: ${message}`);
    });
  });

  socket.on("error", (error) => {
    console.error(`Error: ${error}: ${ip}`);
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });
});

console.log("Websocket Server is live on ws://localhost:8000");
