import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import type { GameEvent, ChatSender } from '@monopoly/shared';
import { GameEngine, EngineError } from './engine/engine.js';
import * as store from './store.js';
import { newGameSchema, actionRequestSchema, chatRequestSchema } from './schemas.js';
import { addClient, broadcast } from './sse.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── GET /api/state ───────────────────────────────────────
app.get('/api/state', (_req, res) => {
  try {
    const state = store.loadState();
    if (!state) {
      res.json({ ok: false, error: 'No game exists. POST /api/game/new to create one.' });
      return;
    }
    res.json({ ok: true, data: state });
  } catch (err) {
    console.error('GET /api/state error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── GET /api/events ──────────────────────────────────────
app.get('/api/events', (req, res) => {
  try {
    const since = req.query.since as string | undefined;
    const events = since ? store.loadEventsSince(since) : store.loadEvents();
    res.json({ ok: true, data: events });
  } catch (err) {
    console.error('GET /api/events error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── GET /api/stream (SSE) ────────────────────────────────
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(':\n\n');
  addClient(res);
  req.on('close', () => {
    // handled in addClient cleanup
  });
});

// ── POST /api/game/new ───────────────────────────────────
app.post('/api/game/new', (req, res) => {
  try {
    const parsed = newGameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const { playerCount, playerNames, seed } = parsed.data;
    const count = playerNames?.length ?? playerCount;

    const { state, event } = GameEngine.createGame(count, playerNames, seed);
    store.saveState(state);
    store.appendEvents([event]);
    broadcast([event]);

    res.json({ ok: true, data: { gameId: state.gameId, players: state.players, event } });
  } catch (err) {
    console.error('POST /api/game/new error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── POST /api/game/start ─────────────────────────────────
app.post('/api/game/start', (_req, res) => {
  try {
    const state = store.loadState();
    if (!state) {
      res.status(404).json({ ok: false, error: 'No game exists' });
      return;
    }

    const engine = new GameEngine(state);
    const events = engine.startGame();
    const newState = engine.getState();
    store.saveState(newState);
    store.appendEvents(events);
    broadcast(events);
    res.json({ ok: true, data: { eventsApplied: events } });
  } catch (err) {
    if (err instanceof EngineError) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    console.error('POST /api/game/start error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── POST /api/action ─────────────────────────────────────
app.post('/api/action', (req, res) => {
  try {
    const parsed = actionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const { gameId, playerId, action } = parsed.data;
    const state = store.loadState();
    if (!state) {
      res.status(404).json({ ok: false, error: 'No game exists' });
      return;
    }
    if (state.gameId !== gameId) {
      res.status(400).json({ ok: false, error: 'Game ID mismatch' });
      return;
    }

    const engine = new GameEngine(state);
    const events = engine.processAction(playerId, action);
    const newState = engine.getState();
    store.saveState(newState);
    store.appendEvents(events);
    broadcast(events);
    res.json({ ok: true, data: { eventsApplied: events } });
  } catch (err) {
    if (err instanceof EngineError) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    console.error('POST /api/action error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── POST /api/chat ───────────────────────────────────────
app.post('/api/chat', (req, res) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const { gameId, from, scope, toPlayerId, text } = parsed.data;
    const state = store.loadState();
    if (!state) {
      res.status(404).json({ ok: false, error: 'No game exists' });
      return;
    }
    if (state.gameId !== gameId) {
      res.status(400).json({ ok: false, error: 'Game ID mismatch' });
      return;
    }

    const base = {
      id: uuid(),
      ts: new Date().toISOString(),
      gameId,
      turn: state.turn,
    };

    let event: GameEvent;
    if (scope === 'private') {
      if (!toPlayerId) {
        res.status(400).json({ ok: false, error: 'toPlayerId required for private chat' });
        return;
      }
      if (!state.players.some((p) => p.id === toPlayerId)) {
        res.status(400).json({ ok: false, error: 'toPlayerId is not a valid player in this game' });
        return;
      }
      event = { ...base, type: 'chat.private' as const, payload: { from: from as ChatSender, toPlayerId, text } };
    } else if (scope === 'tabletalk') {
      event = { ...base, type: 'chat.tabletalk' as const, payload: { from: from as ChatSender, text } };
    } else {
      event = { ...base, type: 'chat.public' as const, payload: { from: from as ChatSender, text } };
    }

    store.appendEvents([event]);
    broadcast([event]);
    res.json({ ok: true, data: { event } });
  } catch (err) {
    console.error('POST /api/chat error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── POST /api/game/reset ─────────────────────────────────
app.post('/api/game/reset', (_req, res) => {
  try {
    store.clearData();
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/game/reset error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Monopoly Arena server running on http://localhost:3001`);
});
