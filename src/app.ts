import AgentAPI from "apminsight";
AgentAPI.config();

import "dotenv/config";
import express from "express";
import http from "http";
import { matchRouter } from "./routes/match.route";
import { commentaryRouter } from "./routes/commentary.route";
import { attachWebSocketServer } from "./ws/server";
import { securityMiddleware } from "./arcjet";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

app.use(securityMiddleware());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.use("/matches", matchRouter);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary } =
  attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(
    `WebSocket Server is running on ${baseUrl.replace(/^http/, "ws")}/ws`
  );
});
