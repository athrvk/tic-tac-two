# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tic-Tac-Two is a real-time multiplayer Tic-Tac-Toe variant where **only the last 6 moves stay on the board** - when a 7th move is made, the oldest move disappears. Java 25 (LTS) / Spring Boot 3.5 backend, React 19 (Vite) frontend, deployed on Render via Docker. No database - all game state is in-memory.

## Commands

### Backend (from `backend/`)
```bash
mvn spring-boot:run       # Run locally on port 8080 (profile "local")
mvn clean package         # Build JAR
mvn test                  # Run tests (JUnit; no custom tests exist yet)
mvn test -Dtest=ClassName # Run a single test class
```

### Frontend (from `frontend/`)
```bash
npm install
npm start                 # Vite dev server on port 3000 (expects backend on localhost:8080)
npm run build             # Production build (outputs to build/)
npm run prebuildlocal && npm run buildlocal  # Build and copy into backend/src/main/resources/static
```

### Full application
```bash
docker-compose up --build             # Build & run everything
docker build -t tic-tac-two .         # Multi-stage build (frontend → backend static → JRE image)
```

CI (`.github/workflows/docker-image.yml`) builds/pushes the Docker image and triggers a Render deploy on pushes to `master`.

## Architecture

### Big picture
Two apps in one repo. In development they run separately (frontend :3000, backend :8080, frontend hardcodes `localhost:8080` for the socket in non-production). In production the frontend build is baked into Spring Boot's `static/` resources during the Docker build and served same-origin on port 10000 (profile `prod`, `application-prod.properties`).

### Real-time communication (raw WebSocket, JSON protocol)
All gameplay flows over a single native WebSocket endpoint `/ws` (no STOMP, no SockJS - removed deliberately; there is no long-polling fallback). `WebSocketConfig` registers `backend/.../websocket/GameWebSocketHandler.java`, which owns the whole protocol:
- Client → server messages (`type` field): `create`, `join`, `move` (carries a client-generated `moveId` plus the full `gameState`), `ping`
- Server → client messages: `room_created` (to the creator only), `room_joined` (join confirmation with assigned symbol and current state), `player_joined`, `game_state` (room broadcast), `ack` (echoes `moveId` after the move is validated and applied), `player_disconnected`, `active_players`, `status_update` (status page feed), `pong`

**Identity:** there is no auth. The frontend generates a random username (`unique-username-generator`) and passes it as the `?username=` query parameter on the `/ws` URL. Connections with `?type=status` are status-page watchers and are excluded from player counts.

**Liveness:** the client pings every 3s and force-closes after 10s of silence; the handler tracks last-seen per session and a 3s sweeper closes dead sessions, which triggers the same cleanup as a normal disconnect (opponent gets `player_disconnected` → forfeit win). On reconnect the client re-joins its room and takes the server's authoritative state.

**Scheduled broadcasts** in `GameWebSocketHandler`: active player count to all players every 2s, all-rooms state to status watchers every 2s.

### Game logic is client-authoritative
The backend does **not** apply game rules or detect winners (it does validate the shape of the state: 9 squares of null/X/O, at most 6 history entries). The frontend (`App.jsx` + `utils/helper.js:calculateWinner`) applies the move, enforces the 6-move cap (`history.length > 6` → remove oldest square), computes the winner, and sends the complete new state in a `move` message; the backend stores it in `GameService`'s `ConcurrentHashMap`, acks the `moveId` back to the sender, and rebroadcasts the state to the room. The client renders its own move optimistically and rolls it back if no ack arrives within 2.5s. Changes to game rules therefore live in the frontend; the backend `GameState` model just mirrors squares/history/xIsNext.

### Room lifecycle (`GameService`)
`joinRoom` is forgiving: joining with no room ID finds any one-player room or creates one; joining a full/nonexistent room silently creates a new room and puts the player there (the client detects `assignedRoomId !== desiredRoomId`). First player in a room gets X, second gets O. `GameWebSocketHandler.afterConnectionClosed` (and the liveness sweeper) cleans up player/room mappings on disconnect. Generated room codes are short 6-char strings; codes are case-insensitive.

### Frontend structure
- `App.jsx` - nearly all game/connection state lives here; routes `/` (game) and `/status` (live dashboard using `utils/statusWebsocket.js` with a separate connection)
- `utils/websocket.js` - singleton `webSocketService` speaking the raw JSON protocol (connect, heartbeat, reconnect + room re-join, move acks)
- `utils/analytics.js` - GA event tracking, called throughout the game flow
- `styles/theme.js` + styled-components - high-contrast, e-ink-friendly palette (black on #f6f6f6, Georgia serif); use theme spacing values (xs/sm/md/lg) and keep components mobile-friendly
- `console.log` is stripped in production builds by the Vite build config

## Testing

- `e2e/` holds a Playwright end-to-end suite that drives the built app; CI runs it via `.github/workflows/e2e.yml` on pushes/PRs to `master`.

## Conventions

- CORS/allowed origins come from the `ALLOWED_ORIGINS` property (`*` locally, the Render domain in prod); keep this in mind when touching `WebSocketConfig` or `WebConfig`.
- Backend uses SLF4J logging and concurrent collections for shared state; several log statements are gated on the `local` profile to keep prod logs quiet.
- When changing game logic or WebSocket behavior, test multiplayer with two browser sessions against a locally running backend.
