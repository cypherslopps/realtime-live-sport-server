import { Server as HttpServer } from "http";
import { WebSocket, Server as WebSocketServer } from "ws";
import { Matches } from "../db/schema";
import { wsArcjet } from "../arcjet";

interface JsonPayload {
  [key: string]: unknown;
}

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
}

function sendJson(socket: WebSocket, payload: JsonPayload): void {
  if (socket.readyState !== WebSocket.OPEN) return;

  try {
    socket.send(JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to send WebSocket message:", err);
  }
}

function broadcast(wss: WebSocketServer, payload: JsonPayload): void {
  wss.clients.forEach((client) => {
    sendJson(client, payload);
  });
}

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  const interval = setInterval(() => {
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (!client.isAlive) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  wss.on("connection", async (socket, req) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Access denied";
          socket.close(code, reason);
          return;
        }
      } catch (err) {
        console.error("WS connection error", err);
        socket.close(1011, "Server security error");
      }
    }

    (socket as ExtendedWebSocket).isAlive = true;
    (socket as ExtendedWebSocket).on(
      "pong",
      () => ((socket as ExtendedWebSocket).isAlive = true)
    );
    sendJson(socket, { type: "welcome" });
    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match: Matches) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
