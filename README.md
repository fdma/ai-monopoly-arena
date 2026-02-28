# AI Monopoly Arena

A full-stack Monopoly game engine with real-time Web UI and HTTP API for AI agent orchestration.

## Quick Start

```bash
pnpm install
pnpm dev          # starts server (port 3001) + web UI (port 5173)
```

Open http://localhost:5173 in your browser.

## Architecture

```
apps/
  server/     Node.js + Express + TypeScript game engine
  web/        Vite + React + TypeScript UI
packages/
  shared/     Shared types & board definition
scripts/
  demoDealer.ts   Bot script that plays a full game
data/
  state.json      Current game state snapshot
  events.jsonl    Append-only event log (source of truth)
```

### How It Works

1. **Game Engine** (`apps/server/src/engine/`) maintains game state as a deterministic state machine
2. **Events** are the single source of truth — every state change produces typed events
3. **Dealer / Orchestrator** sends actions via `POST /api/action` and receives events via SSE
4. **Web UI** subscribes to `GET /api/stream` (SSE) for real-time updates

### State Machine Phases

```
pre_game → awaiting_roll → (dice) →
  → awaiting_buy_decision → BUY | PASS →
    → awaiting_auction_bids → SUBMIT_AUCTION_BIDS →
  → turn_end → END_TURN → awaiting_roll (next player)

Jail: awaiting_jail_decision → PAY_JAIL_FINE | ROLL_JAIL_DOUBLES
Game over: game_over
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/state` | Current game state |
| GET | `/api/events?since=<eventId>` | Event history |
| GET | `/api/stream` | SSE real-time event stream |
| POST | `/api/game/new` | Create new game |
| POST | `/api/game/start` | Start the game |
| POST | `/api/action` | Submit player action |
| POST | `/api/chat` | Send chat message |
| POST | `/api/game/reset` | Reset (delete state) |

## curl Examples

### Create a game

```bash
curl -X POST http://localhost:3001/api/game/new \
  -H 'Content-Type: application/json' \
  -d '{"playerNames": ["Alice", "Bob", "Charlie", "Diana"], "seed": 42}'
```

### Start the game

```bash
curl -X POST http://localhost:3001/api/game/start
```

### Roll dice (submit action)

```bash
curl -X POST http://localhost:3001/api/action \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "<GAME_ID>",
    "playerId": "<PLAYER_ID>",
    "action": { "type": "ROLL_DICE" }
  }'
```

### Buy property

```bash
curl -X POST http://localhost:3001/api/action \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "<GAME_ID>",
    "playerId": "<PLAYER_ID>",
    "action": { "type": "BUY" }
  }'
```

### Pass on buying (triggers auction)

```bash
curl -X POST http://localhost:3001/api/action \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "<GAME_ID>",
    "playerId": "<PLAYER_ID>",
    "action": { "type": "PASS" }
  }'
```

### Submit auction bids

```bash
curl -X POST http://localhost:3001/api/action \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "<GAME_ID>",
    "playerId": "<PLAYER_ID>",
    "action": {
      "type": "SUBMIT_AUCTION_BIDS",
      "bids": { "<P1_ID>": 100, "<P2_ID>": 150, "<P3_ID>": 0 }
    }
  }'
```

### End turn

```bash
curl -X POST http://localhost:3001/api/action \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "<GAME_ID>",
    "playerId": "<PLAYER_ID>",
    "action": { "type": "END_TURN" }
  }'
```

### Send chat

```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "<GAME_ID>",
    "from": { "kind": "dealer", "name": "OpenClaw" },
    "scope": "public",
    "text": "Hello from the orchestrator!"
  }'
```

### Listen to SSE stream

```bash
curl -N http://localhost:3001/api/stream
```

## Demo Dealer (Bot Play)

Run 4 bots that play a full game automatically:

```bash
# Server must be running first
pnpm dealer
```

The dealer creates a game, starts it, and plays turns using simple heuristics (buy if affordable, pay jail fine, submit auction bids).

## Reset Game

```bash
pnpm reset
# or
curl -X POST http://localhost:3001/api/game/reset
```

## Tests

```bash
pnpm test
```

Runs 15 unit tests covering: RNG determinism, game creation, dice rolling, property buying, rent payment, GO salary, jail mechanics, bankruptcy, turn advancement, and action validation.

## Connecting an External Orchestrator (e.g., OpenClaw)

1. **Get state**: `GET /api/state` — returns full game state including `phase` which tells you what action is expected
2. **Subscribe to events**: `GET /api/stream` (SSE) — receive real-time events as they happen
3. **Send actions**: `POST /api/action` with `{ gameId, playerId, action: { type, ... } }`
4. **Send chat**: `POST /api/chat` with `{ gameId, from, scope, text }`

The orchestrator's loop:
1. Create game via `POST /api/game/new`
2. Start via `POST /api/game/start`
3. Read `state.phase` to determine what action is needed
4. Submit the action via `POST /api/action`
5. Repeat until `game.ended` event

### Action Types

| Action | When | Fields |
|--------|------|--------|
| `ROLL_DICE` | `awaiting_roll` | — |
| `BUY` | `awaiting_buy_decision` | — |
| `PASS` | `awaiting_buy_decision` | — |
| `SUBMIT_AUCTION_BIDS` | `awaiting_auction_bids` | `bids: { [playerId]: amount }` |
| `PAY_JAIL_FINE` | `awaiting_jail_decision` | — |
| `ROLL_JAIL_DOUBLES` | `awaiting_jail_decision` | — |
| `END_TURN` | `turn_end` | — |

## Production Build

```bash
pnpm build
pnpm start    # runs server from dist/
```

## Tech Stack

- **Backend**: Node.js, Express 5, TypeScript
- **Frontend**: Vite, React 19, TypeScript
- **Realtime**: Server-Sent Events (SSE)
- **Validation**: Zod
- **Storage**: JSON files (no database)
- **RNG**: Seedable mulberry32 PRNG
