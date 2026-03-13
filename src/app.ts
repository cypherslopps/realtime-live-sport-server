import "dotenv/config";
import express from "express";
import { matchRouter } from "./routes/match.route";

const app = express();
const port = process.env.port || 8000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.use("/matches", matchRouter);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
