import { Server as HttpServer } from "http";
import { WebSocket, Server as WebSocketServer } from "ws";
import { Matches } from "../db/schema";

interface JsonPayload {
  [key: string]: unknown;
}

function sendJson(socket: WebSocket, payload: JsonPayload): void {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: JsonPayload): void {
  wss.clients.forEach((client) => {
    sendJson(client as WebSocket, payload);
  });
}

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket) => {
    sendJson(socket, { type: "Welcome" });
    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match: Matches) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
