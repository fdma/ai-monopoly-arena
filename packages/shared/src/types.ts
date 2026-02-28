import type { ColorGroup } from './board.js';

// ── Player ──────────────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  color: string;
  position: number;
  money: number;
  isInJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  properties: number[]; // cell indices
}

// ── Property ownership ─────────────────────────────────
export interface PropertyState {
  cellIndex: number;
  ownerId: string | null;
  houses: number; // 0-4 houses, 5 = hotel (future)
  isMortgaged: boolean;
}

// ── Game phase (state machine) ─────────────────────────
export type GamePhase =
  | { type: 'pre_game' }
  | { type: 'awaiting_roll' }
  | { type: 'awaiting_buy_decision'; cellIndex: number; price: number }
  | { type: 'awaiting_auction_bids'; cellIndex: number }
  | { type: 'awaiting_jail_decision' }
  | { type: 'turn_end' }
  | { type: 'game_over'; winnerId: string };

// ── Game state (full snapshot) ─────────────────────────
export interface GameState {
  gameId: string;
  status: 'waiting' | 'playing' | 'finished';
  seed: number;
  rngState: number;
  turn: number;
  currentPlayerIndex: number;
  players: Player[];
  properties: PropertyState[];
  phase: GamePhase;
  lastDice: [number, number] | null;
  lastEventId: string;
}

// ── Actions (from dealer/orchestrator) ─────────────────
export type GameAction =
  | { type: 'ROLL_DICE' }
  | { type: 'BUY' }
  | { type: 'PASS' }
  | { type: 'SUBMIT_AUCTION_BIDS'; bids: Record<string, number> }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'ROLL_JAIL_DOUBLES' }
  | { type: 'END_TURN' }
  | { type: 'BUILD_HOUSE'; cellIndex: number }
  | { type: 'SELL_HOUSE'; cellIndex: number }
  // Future extensibility:
  | { type: 'TRADE'; offer: unknown }
  | { type: 'MORTGAGE'; cellIndex: number };

// ── Chat ───────────────────────────────────────────────
export interface ChatSender {
  kind: 'player' | 'dealer' | 'system';
  id?: string;
  name?: string;
}

export type ChatScope = 'public' | 'tabletalk' | 'private';

// ── Events ─────────────────────────────────────────────
interface BaseEvent {
  id: string;
  ts: string;
  gameId: string;
  turn: number;
}

export type GameEvent =
  | BaseEvent & { type: 'game.created'; payload: { players: Player[]; seed: number } }
  | BaseEvent & { type: 'game.started'; payload: Record<string, never> }
  | BaseEvent & { type: 'turn.started'; payload: { playerId: string; playerName: string } }
  | BaseEvent & { type: 'dice.rolled'; payload: { playerId: string; dice: [number, number]; total: number; doubles: boolean } }
  | BaseEvent & { type: 'player.moved'; payload: { playerId: string; from: number; to: number; cellName: string; passedGo: boolean } }
  | BaseEvent & { type: 'go.collected'; payload: { playerId: string; amount: number } }
  | BaseEvent & { type: 'property.offered'; payload: { playerId: string; cellIndex: number; cellName: string; price: number } }
  | BaseEvent & { type: 'property.bought'; payload: { playerId: string; cellIndex: number; cellName: string; price: number } }
  | BaseEvent & { type: 'rent.paid'; payload: { fromPlayerId: string; toPlayerId: string; amount: number; cellIndex: number; cellName: string } }
  | BaseEvent & { type: 'tax.paid'; payload: { playerId: string; amount: number; cellName: string } }
  | BaseEvent & { type: 'card.drawn'; payload: { playerId: string; deckType: 'chance' | 'community_chest'; description: string; amount: number } }
  | BaseEvent & { type: 'player.sentToJail'; payload: { playerId: string } }
  | BaseEvent & { type: 'player.releasedFromJail'; payload: { playerId: string; method: 'paid_fine' | 'rolled_doubles' | 'forced_pay' } }
  | BaseEvent & { type: 'auction.started'; payload: { cellIndex: number; cellName: string } }
  | BaseEvent & { type: 'auction.bidPlaced'; payload: { playerId: string; amount: number } }
  | BaseEvent & { type: 'auction.ended'; payload: { cellIndex: number; cellName: string; winnerId: string | null; winnerName: string | null; amount: number } }
  | BaseEvent & { type: 'house.built'; payload: { playerId: string; cellIndex: number; cellName: string; houses: number; cost: number } }
  | BaseEvent & { type: 'house.sold'; payload: { playerId: string; cellIndex: number; cellName: string; houses: number; revenue: number } }
  | BaseEvent & { type: 'player.bankrupt'; payload: { playerId: string; playerName: string } }
  | BaseEvent & { type: 'game.ended'; payload: { winnerId: string; winnerName: string } }
  | BaseEvent & { type: 'chat.public'; payload: { from: ChatSender; text: string } }
  | BaseEvent & { type: 'chat.tabletalk'; payload: { from: ChatSender; text: string } }
  | BaseEvent & { type: 'chat.private'; payload: { from: ChatSender; toPlayerId: string; text: string } };

export type GameEventType = GameEvent['type'];

// ── API request/response types ─────────────────────────
export interface ActionRequest {
  gameId: string;
  playerId: string;
  action: GameAction;
}

export interface ChatRequest {
  gameId: string;
  from: ChatSender;
  scope: ChatScope;
  toPlayerId?: string;
  text: string;
}

export interface NewGameRequest {
  playerNames?: string[];
  playerCount?: number;
  seed?: number;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
