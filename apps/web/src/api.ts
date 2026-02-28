import type { GameState, GameEvent } from './types';

const BASE = '';

export async function fetchState(): Promise<GameState | null> {
  const res = await fetch(`${BASE}/api/state`);
  const json = await res.json();
  return json.ok ? json.data : null;
}

export async function fetchEvents(sinceId?: string): Promise<GameEvent[]> {
  const url = sinceId ? `${BASE}/api/events?since=${sinceId}` : `${BASE}/api/events`;
  const res = await fetch(url);
  const json = await res.json();
  return json.ok ? json.data : [];
}

export async function createGame(playerNames?: string[], seed?: number): Promise<unknown> {
  const res = await fetch(`${BASE}/api/game/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerNames, playerCount: playerNames?.length ?? 4, seed }),
  });
  return res.json();
}

export async function startGame(): Promise<unknown> {
  const res = await fetch(`${BASE}/api/game/start`, { method: 'POST' });
  return res.json();
}

export async function sendAction(
  gameId: string,
  playerId: string,
  action: { type: string; [key: string]: unknown },
): Promise<unknown> {
  const res = await fetch(`${BASE}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, playerId, action }),
  });
  return res.json();
}

export async function resetGame(): Promise<unknown> {
  const res = await fetch(`${BASE}/api/game/reset`, { method: 'POST' });
  return res.json();
}

export function createEventSource(): EventSource {
  return new EventSource(`${BASE}/api/stream`);
}
