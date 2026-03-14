# Live Sports WebSocket App

A real-time sports commentary and match tracking API built with **Node.js, Express, WebSockets (ws), Drizzle ORM**, and **PostgreSQL**.

This project demonstrates a full-stack approach for delivering live sports events with WebSocket pub/sub broadcasting, REST APIs for match & commentary management, and seed data generation for development/testing.

---

## 🚀 Key Features

- **REST API** for creating and querying matches and commentary.
- **WebSocket pub/sub** to broadcast new matches and match commentary to connected clients.
- **Type-safe schema validation** using **Zod**.
- **Drizzle ORM** for PostgreSQL data modeling and queries.
- **Rate limiting & bot protection** via **Arcjet** (HTTP + WS).
- **Seed generator** to populate matches/commentary via REST (useful for local dev).
- **Heartbeat & clean-up** logic for WebSocket connections.

---

## 📦 Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Server        | Node.js, Express, TypeScript |
| WebSockets    | `ws`                         |
| Validation    | Zod                          |
| ORM           | Drizzle ORM (PostgreSQL)     |
| Rate limiting | Arcjet                       |
| Testing / Dev | nodemon, ts-node             |

---

## 🧠 Project Structure

```text
server/
  src/
    app.ts                  # Express app entrypoint
    ws/server.ts            # WebSocket server + pub/sub + heartbeat
    routes/
      match.route.ts        # REST endpoints for matches
      commentary.route.ts   # REST endpoints for match commentary
    validation/
      matches.ts            # Zod validation schemas for matches
      commentary.ts         # Zod validation schemas for commentary
    db/
      schema.ts             # Drizzle schema definitions (matches, commentary)
      db.ts                 # Drizzle database connection
    arcjet.ts               # Arcjet rate limiting / bot protection
    seed/seed.ts            # Seed runner for generating matches/commentary
  package.json
  tsconfig.json
```

---

## ✅ Getting Started (Local Development)

### 1) Prerequisites

- Node.js (>= 20)
- PostgreSQL
- `pnpm`, `npm`, or `yarn` (example uses `npm`)

### 2) Setup the environment

Create a `.env` file in `server/` (or set environment variables):

```env
PORT=8000
HOST=0.0.0.0
DATABASE_URL=postgres://user:password@localhost:5432/live_sports
ARCJET_KEY=<your-arcjet-key>
```

### 3) Install dependencies

```bash
cd server
npm install
```

### 4) Database migrations

```bash
npm run db:migrate
```

### 5) Start the server

```bash
npm run dev
```

### 6) Seed demo data (optional)

```bash
node --loader ts-node/esm src/seed/seed.ts
```

---

## 🧩 API Endpoints

### Matches

- `GET /matches` - list matches
- `POST /matches` - create a match

### Commentary (nested under match)

- `GET /matches/:id/commentary` - list commentary for a match
- `POST /matches/:id/commentary` - create new commentary

---

## 🔌 WebSocket API

The WebSocket endpoint is available at:

```
ws://<host>:<port>/ws
```

### Supported message types (JSON)

- **subscribe**
  ```json
  { "type": "subscribe", "matchId": <number> }
  ```
- **unsubscribe**
  ```json
  { "type": "unsubscribe", "matchId": <number> }
  ```

### Broadcasts

- `match_created` — emitted when a match is created via REST
- `commentary` — emitted when a commentary entry is created

---

## 🛡 Security & Rate Limiting

The app integrates **Arcjet** to apply request throttling and bot protection for both HTTP and WebSocket traffic.

---

## 🧪 Tests (TODO)

No unit/integration tests are included yet. Future improvements can include:

- Jest + Supertest for API routes
- WebSocket integration tests
- Database migrations + seed tests

---

## 🧭 Extending the App

### Add new event types

- Extend `commentary` schema and add new APIs to handle special event logic (e.g. goal updates, score updates).

### Add authentication

- Add JWT auth to REST + WS connections.

---

## 📚 Useful Commands

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Run in development mode (ts-node + nodemon) |
| `npm start`          | Build and start production server           |
| `npm run lint`       | Run ESLint checks                           |
| `npm run db:migrate` | Run Drizzle migrations                      |

---

## 🔍 Notes

- The seed script is designed to be run against the running REST API and is located at `server/src/seed/seed.ts`.
- The WebSocket server is integrated into the same HTTP server in `server/src/ws/server.ts`.
- The app uses strong typing via TypeScript and schema validation via Zod to ensure request payloads are safe.

---

## 📦 License

MIT
