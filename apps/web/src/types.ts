// Re-declare shared types for the web client to avoid workspace build complexity.
// These mirror @monopoly/shared types exactly.

export type CellType =
  | 'go' | 'property' | 'railroad' | 'utility' | 'tax'
  | 'chance' | 'community_chest' | 'jail' | 'free_parking' | 'go_to_jail';

export type ColorGroup =
  | 'brown' | 'lightBlue' | 'pink' | 'orange'
  | 'red' | 'yellow' | 'green' | 'darkBlue';

export interface Cell {
  index: number;
  name: string;
  type: CellType;
  colorGroup?: ColorGroup;
  price?: number;
  baseRent?: number;
  rents?: number[];
  houseCost?: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  position: number;
  money: number;
  isInJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  properties: number[];
}

export interface PropertyState {
  cellIndex: number;
  ownerId: string | null;
  houses: number;
  isMortgaged: boolean;
}

export type GamePhase =
  | { type: 'pre_game' }
  | { type: 'awaiting_roll' }
  | { type: 'awaiting_buy_decision'; cellIndex: number; price: number }
  | { type: 'awaiting_auction_bids'; cellIndex: number }
  | { type: 'awaiting_jail_decision' }
  | { type: 'turn_end' }
  | { type: 'game_over'; winnerId: string };

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

export interface ChatSender {
  kind: 'player' | 'dealer' | 'system';
  id?: string;
  name?: string;
}

export interface GameEvent {
  id: string;
  ts: string;
  gameId: string;
  turn: number;
  type: string;
  payload: Record<string, unknown>;
}
