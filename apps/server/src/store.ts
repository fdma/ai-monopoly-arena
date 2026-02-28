import fs from 'node:fs';
import path from 'node:path';
import type { GameState, GameEvent } from '@monopoly/shared';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadState(): GameState | null {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) return null;
  const raw = fs.readFileSync(STATE_FILE, 'utf-8');
  return JSON.parse(raw) as GameState;
}

export function saveState(state: GameState): void {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function appendEvents(events: GameEvent[]): void {
  ensureDataDir();
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(EVENTS_FILE, lines, 'utf-8');
}

export function loadEvents(): GameEvent[] {
  ensureDataDir();
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const raw = fs.readFileSync(EVENTS_FILE, 'utf-8').trim();
  if (!raw) return [];
  return raw.split('\n').map((line) => JSON.parse(line) as GameEvent);
}

export function loadEventsSince(sinceId: string): GameEvent[] {
  const all = loadEvents();
  const idx = all.findIndex((e) => e.id === sinceId);
  if (idx === -1) return all;
  return all.slice(idx + 1);
}

export function clearData(): void {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(EVENTS_FILE)) fs.unlinkSync(EVENTS_FILE);
}
