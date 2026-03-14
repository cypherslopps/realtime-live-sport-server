import { Server as HttpServer } from "http";
import { WebSocket, Server as WebSocketServer, RawData } from "ws";
import { Commentary, Matches } from "../db/schema";
import { wsArcjet } from "../arcjet";

interface JsonPayload {
  [key: string]: unknown;
}

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  subscriptions?: Set<number>;
}

const matchSubscribers = new Map();

function subscribe(matchId: number, socket: WebSocket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId)?.add(socket);
}

function unsubscribe(matchId: number, socket: WebSocket) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanUpSubscriptions(socket: WebSocket) {
  for (const [matchId] of matchSubscribers.entries()) {
    unsubscribe(matchId, socket);
  }
}

interface IncomingMessage {
  type: string;
  matchId: number;
}

function handleMessage(socket: ExtendedWebSocket, data: RawData): void {
  let message: IncomingMessage;

  try {
    message = JSON.parse(data.toString());

    if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
      subscribe(message.matchId, socket);
      socket.subscriptions?.add(message.matchId);
      sendJson(socket, { type: "subscribed", matchId: message.matchId });
    }

    if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
      unsubscribe(message.matchId, socket);
      socket.subscriptions?.delete(message.matchId);
      sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
    }
  } catch {
    sendJson(socket, { type: "error", error: "Invalid JSON format." });
  }
}

function sendJson(socket: WebSocket, payload: JsonPayload): void {
  if (socket.readyState !== WebSocket.OPEN) return;

  try {
    socket.send(JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to send WebSocket message:", err);
  }
}

function broadcastToAll(wss: WebSocketServer, payload: JsonPayload): void {
  wss.clients.forEach((client) => {
    sendJson(client, payload);
  });
}

function broadcastToMatch(matchId: number, payload: JsonPayload) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(payload));
      } catch (err) {
        console.error("Failed to send WebSocket message:", err);
      }
    }
  }
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
        const decision = await wsArcjet.protect(req);

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

  wss.on("connection", (socket: ExtendedWebSocket) => {
    socket.isAlive = true;
    socket.on("pong", () => (socket.isAlive = true));

    socket.subscriptions = new Set();

    sendJson(socket, { type: "welcome" });

    socket.on("message", (data) => handleMessage(socket, data));
    socket.on("error", () => socket.terminate());
    socket.on("close", () => cleanUpSubscriptions(socket));
    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match: Matches) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId: number, comment: Commentary) {
    broadcastToMatch(matchId, { type: "commentary", data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
