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
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req, socket, head) => {
    if (req.url === "/ws" || req.url === "/ws/") {
      try {
        const decision = await wsArcjet.protect(req as any);

        if (decision.isDenied()) {
          const statusCode = decision.reason.isRateLimit() ? 429 : 403;
          const reason = decision.reason.isRateLimit()
            ? "Too Many Requests"
            : "Forbidden";
          socket.write(`HTTP/1.1 ${statusCode} ${reason}\r\n\r\n`);
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      } catch (err) {
        console.error("WS connection error", err);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
      }
    } else {
      socket.destroy();
    }
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

  wss.on("connection", (socket, req) => {
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
