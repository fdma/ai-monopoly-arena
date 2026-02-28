import { v4 as uuid } from 'uuid';
import {
  BOARD,
  BOARD_SIZE,
  GO_SALARY,
  JAIL_FINE,
  JAIL_POSITION,
  MAX_HOUSES,
  MAX_JAIL_TURNS,
  STARTING_MONEY,
  type GameState,
  type GameEvent,
  type GameAction,
  type Player,
  type PropertyState,
  type GamePhase,
  type Cell,
} from '@monopoly/shared';
import { SeededRNG } from './rng.js';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];

export class GameEngine {
  private state: GameState;
  private rng: SeededRNG;

  constructor(state: GameState) {
    this.state = structuredClone(state);
    this.rng = SeededRNG.fromState(state.rngState);
  }

  getState(): GameState {
    return structuredClone(this.state);
  }

  // ── Factory ────────────────────────────────────────────

  static createGame(
    playerCount: number,
    playerNames?: string[],
    seed?: number,
  ): { state: GameState; event: GameEvent } {
    const actualSeed = seed ?? Math.floor(Math.random() * 2147483647);
    const gameId = uuid();
    const players: Player[] = [];

    for (let i = 0; i < playerCount; i++) {
      players.push({
        id: uuid(),
        name: playerNames?.[i] ?? DEFAULT_NAMES[i]!,
        color: PLAYER_COLORS[i]!,
        position: 0,
        money: STARTING_MONEY,
        isInJail: false,
        jailTurns: 0,
        isBankrupt: false,
        properties: [],
      });
    }

    const properties: PropertyState[] = BOARD
      .filter((c) => c.type === 'property' || c.type === 'railroad' || c.type === 'utility')
      .map((c) => ({
        cellIndex: c.index,
        ownerId: null,
        houses: 0,
        isMortgaged: false,
      }));

    const event: GameEvent = {
      id: uuid(),
      ts: new Date().toISOString(),
      gameId,
      turn: 0,
      type: 'game.created',
      payload: { players: structuredClone(players), seed: actualSeed },
    };

    const state: GameState = {
      gameId,
      status: 'waiting',
      seed: actualSeed,
      rngState: actualSeed,
      turn: 0,
      currentPlayerIndex: 0,
      players,
      properties,
      phase: { type: 'pre_game' },
      lastDice: null,
      lastEventId: event.id,
    };

    return { state, event };
  }

  // ── Start game ─────────────────────────────────────────

  startGame(): GameEvent[] {
    if (this.state.status !== 'waiting') {
      throw new EngineError('Game is not in waiting state');
    }
    this.state.status = 'playing';
    this.state.turn = 1;

    const startedEvent = this.makeEvent('game.started', {});
    const currentPlayer = this.currentPlayer();

    const phase: GamePhase = currentPlayer.isInJail
      ? { type: 'awaiting_jail_decision' }
      : { type: 'awaiting_roll' };
    this.state.phase = phase;

    const turnEvent = this.makeEvent('turn.started', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
    });

    return [startedEvent, turnEvent];
  }

  // ── Process action ─────────────────────────────────────

  processAction(playerId: string, action: GameAction): GameEvent[] {
    const currentPlayer = this.currentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new EngineError(`Not your turn. Current player: ${currentPlayer.name}`);
    }
    if (this.state.status !== 'playing') {
      throw new EngineError('Game is not in playing state');
    }

    switch (action.type) {
      case 'ROLL_DICE':
        return this.handleRollDice();
      case 'BUY':
        return this.handleBuy();
      case 'PASS':
        return this.handlePass();
      case 'SUBMIT_AUCTION_BIDS':
        return this.handleAuctionBids(action.bids);
      case 'PAY_JAIL_FINE':
        return this.handlePayJailFine();
      case 'ROLL_JAIL_DOUBLES':
        return this.handleRollJailDoubles();
      case 'END_TURN':
        return this.handleEndTurn();
      case 'BUILD_HOUSE':
        return this.handleBuildHouse(action.cellIndex);
      case 'SELL_HOUSE':
        return this.handleSellHouse(action.cellIndex);
      default:
        throw new EngineError(`Action type not implemented: ${(action as GameAction).type}`);
    }
  }

  // ── Action handlers ────────────────────────────────────

  private handleRollDice(): GameEvent[] {
    this.assertPhase('awaiting_roll');
    const events: GameEvent[] = [];
    const player = this.currentPlayer();

    const dice = this.rng.rollDice();
    this.state.rngState = this.rng.getState();
    const total = dice[0] + dice[1];
    const doubles = dice[0] === dice[1];
    this.state.lastDice = dice;

    events.push(
      this.makeEvent('dice.rolled', {
        playerId: player.id,
        dice,
        total,
        doubles,
      }),
    );

    // Move player
    const from = player.position;
    const to = (from + total) % BOARD_SIZE;
    const passedGo = from + total >= BOARD_SIZE;
    player.position = to;
    const cell = BOARD[to]!;

    events.push(
      this.makeEvent('player.moved', {
        playerId: player.id,
        from,
        to,
        cellName: cell.name,
        passedGo,
      }),
    );

    if (passedGo) {
      player.money += GO_SALARY;
      events.push(this.makeEvent('go.collected', { playerId: player.id, amount: GO_SALARY }));
    }

    // Process landing
    const landingEvents = this.processLanding(player, cell);
    events.push(...landingEvents);

    return events;
  }

  private processLanding(player: Player, cell: Cell): GameEvent[] {
    const events: GameEvent[] = [];

    switch (cell.type) {
      case 'property':
      case 'railroad':
      case 'utility': {
        const prop = this.getProperty(cell.index);
        if (!prop || prop.ownerId === null) {
          // Unowned — offer to buy
          this.state.phase = { type: 'awaiting_buy_decision', cellIndex: cell.index, price: cell.price! };
          events.push(
            this.makeEvent('property.offered', {
              playerId: player.id,
              cellIndex: cell.index,
              cellName: cell.name,
              price: cell.price!,
            }),
          );
        } else if (prop.ownerId !== player.id && !prop.isMortgaged) {
          // Owned by someone else — pay rent
          const rent = this.calculateRent(cell, prop);
          const owner = this.state.players.find((p) => p.id === prop.ownerId)!;
          const actualRent = Math.min(rent, player.money);
          player.money -= actualRent;
          owner.money += actualRent;

          events.push(
            this.makeEvent('rent.paid', {
              fromPlayerId: player.id,
              toPlayerId: owner.id,
              amount: actualRent,
              cellIndex: cell.index,
              cellName: cell.name,
            }),
          );

          if (player.money <= 0) {
            events.push(...this.bankruptPlayer(player));
          } else {
            this.state.phase = { type: 'turn_end' };
          }
        } else {
          // Own property or mortgaged — nothing
          this.state.phase = { type: 'turn_end' };
        }
        break;
      }

      case 'tax': {
        const taxAmount = cell.price!;
        player.money -= taxAmount;
        events.push(
          this.makeEvent('tax.paid', {
            playerId: player.id,
            amount: taxAmount,
            cellName: cell.name,
          }),
        );
        if (player.money <= 0) {
          events.push(...this.bankruptPlayer(player));
        } else {
          this.state.phase = { type: 'turn_end' };
        }
        break;
      }

      case 'go_to_jail': {
        events.push(...this.sendToJail(player));
        break;
      }

      case 'chance':
      case 'community_chest': {
        const cardEvents = this.drawCard(player, cell.type);
        events.push(...cardEvents);
        break;
      }

      default:
        // go, jail (just visiting), free_parking — nothing
        this.state.phase = { type: 'turn_end' };
        break;
    }

    return events;
  }

  private handleBuy(): GameEvent[] {
    const phase = this.state.phase;
    if (phase.type !== 'awaiting_buy_decision') {
      throw new EngineError('Not in buy decision phase');
    }
    const player = this.currentPlayer();
    const cell = BOARD[phase.cellIndex]!;

    if (player.money < phase.price) {
      throw new EngineError('Not enough money to buy');
    }

    player.money -= phase.price;
    const prop = this.getProperty(phase.cellIndex)!;
    prop.ownerId = player.id;
    player.properties.push(phase.cellIndex);

    this.state.phase = { type: 'turn_end' };

    return [
      this.makeEvent('property.bought', {
        playerId: player.id,
        cellIndex: phase.cellIndex,
        cellName: cell.name,
        price: phase.price,
      }),
    ];
  }

  private handlePass(): GameEvent[] {
    const phase = this.state.phase;
    if (phase.type !== 'awaiting_buy_decision') {
      throw new EngineError('Not in buy decision phase');
    }
    const cell = BOARD[phase.cellIndex]!;

    this.state.phase = { type: 'awaiting_auction_bids', cellIndex: phase.cellIndex };

    return [
      this.makeEvent('auction.started', {
        cellIndex: phase.cellIndex,
        cellName: cell.name,
      }),
    ];
  }

  private handleAuctionBids(bids: Record<string, number>): GameEvent[] {
    const phase = this.state.phase;
    if (phase.type !== 'awaiting_auction_bids') {
      throw new EngineError('Not in auction phase');
    }
    const events: GameEvent[] = [];
    const cell = BOARD[phase.cellIndex]!;

    // Validate bids
    const activePlayers = this.state.players.filter((p) => !p.isBankrupt);
    let highestBid = 0;
    let winnerId: string | null = null;

    for (const player of activePlayers) {
      const bid = bids[player.id] ?? 0;
      if (bid < 0) throw new EngineError(`Invalid bid from ${player.name}: ${bid}`);
      if (bid > player.money) throw new EngineError(`${player.name} cannot afford bid of ${bid}`);

      if (bid > 0) {
        events.push(this.makeEvent('auction.bidPlaced', { playerId: player.id, amount: bid }));
      }

      if (bid > highestBid) {
        highestBid = bid;
        winnerId = player.id;
      }
    }

    if (winnerId && highestBid > 0) {
      const winner = this.state.players.find((p) => p.id === winnerId)!;
      winner.money -= highestBid;
      const prop = this.getProperty(phase.cellIndex)!;
      prop.ownerId = winnerId;
      winner.properties.push(phase.cellIndex);

      events.push(
        this.makeEvent('auction.ended', {
          cellIndex: phase.cellIndex,
          cellName: cell.name,
          winnerId,
          winnerName: winner.name,
          amount: highestBid,
        }),
      );
    } else {
      events.push(
        this.makeEvent('auction.ended', {
          cellIndex: phase.cellIndex,
          cellName: cell.name,
          winnerId: null,
          winnerName: null,
          amount: 0,
        }),
      );
    }

    this.state.phase = { type: 'turn_end' };
    return events;
  }

  private handlePayJailFine(): GameEvent[] {
    this.assertPhase('awaiting_jail_decision');
    const player = this.currentPlayer();

    if (!player.isInJail) throw new EngineError('Player is not in jail');
    if (player.money < JAIL_FINE) throw new EngineError('Not enough money to pay jail fine');

    player.money -= JAIL_FINE;
    player.isInJail = false;
    player.jailTurns = 0;

    this.state.phase = { type: 'awaiting_roll' };

    return [
      this.makeEvent('player.releasedFromJail', { playerId: player.id, method: 'paid_fine' }),
    ];
  }

  private handleRollJailDoubles(): GameEvent[] {
    this.assertPhase('awaiting_jail_decision');
    const player = this.currentPlayer();
    if (!player.isInJail) throw new EngineError('Player is not in jail');

    const dice = this.rng.rollDice();
    this.state.rngState = this.rng.getState();
    const total = dice[0] + dice[1];
    const doubles = dice[0] === dice[1];
    this.state.lastDice = dice;

    const events: GameEvent[] = [
      this.makeEvent('dice.rolled', { playerId: player.id, dice, total, doubles }),
    ];

    if (doubles) {
      player.isInJail = false;
      player.jailTurns = 0;
      events.push(
        this.makeEvent('player.releasedFromJail', { playerId: player.id, method: 'rolled_doubles' }),
      );

      // Move the player
      const from = player.position;
      const to = (from + total) % BOARD_SIZE;
      const passedGo = from + total >= BOARD_SIZE;
      player.position = to;
      const cell = BOARD[to]!;

      events.push(
        this.makeEvent('player.moved', { playerId: player.id, from, to, cellName: cell.name, passedGo }),
      );

      if (passedGo) {
        player.money += GO_SALARY;
        events.push(this.makeEvent('go.collected', { playerId: player.id, amount: GO_SALARY }));
      }

      events.push(...this.processLanding(player, cell));
    } else {
      player.jailTurns++;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        // Forced to pay
        player.money -= JAIL_FINE;
        player.isInJail = false;
        player.jailTurns = 0;
        events.push(
          this.makeEvent('player.releasedFromJail', { playerId: player.id, method: 'forced_pay' }),
        );
        if (player.money <= 0) {
          events.push(...this.bankruptPlayer(player));
        } else {
          this.state.phase = { type: 'awaiting_roll' };
        }
      } else {
        this.state.phase = { type: 'turn_end' };
      }
    }

    return events;
  }

  private handleEndTurn(): GameEvent[] {
    if (this.state.phase.type !== 'turn_end') {
      throw new EngineError('Cannot end turn in current phase');
    }

    // Check for game over
    const activePlayers = this.state.players.filter((p) => !p.isBankrupt);
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0]!;
      this.state.status = 'finished';
      this.state.phase = { type: 'game_over', winnerId: winner.id };
      return [
        this.makeEvent('game.ended', { winnerId: winner.id, winnerName: winner.name }),
      ];
    }

    // Advance to next player
    this.advanceToNextPlayer();
    this.state.turn++;

    const nextPlayer = this.currentPlayer();
    const phase: GamePhase = nextPlayer.isInJail
      ? { type: 'awaiting_jail_decision' }
      : { type: 'awaiting_roll' };
    this.state.phase = phase;

    return [
      this.makeEvent('turn.started', {
        playerId: nextPlayer.id,
        playerName: nextPlayer.name,
      }),
    ];
  }

  // ── Building houses/hotels ──────────────────────────────

  private handleBuildHouse(cellIndex: number): GameEvent[] {
    const phase = this.state.phase.type;
    if (phase !== 'awaiting_roll' && phase !== 'turn_end') {
      throw new EngineError('Can only build houses before rolling or before ending turn');
    }

    const player = this.currentPlayer();
    const cell = BOARD[cellIndex]!;

    if (cell.type !== 'property' || !cell.colorGroup) {
      throw new EngineError('Can only build on color-group properties');
    }

    const prop = this.getProperty(cellIndex);
    if (!prop || prop.ownerId !== player.id) {
      throw new EngineError('You do not own this property');
    }

    // Must own all properties in the color group (monopoly)
    const groupCells = BOARD.filter((c) => c.colorGroup === cell.colorGroup);
    const groupProps = groupCells.map((c) => this.getProperty(c.index)!);
    const ownsAll = groupProps.every((p) => p.ownerId === player.id);
    if (!ownsAll) {
      throw new EngineError('Must own all properties in the color group to build');
    }

    // Check no property in group is mortgaged
    if (groupProps.some((p) => p.isMortgaged)) {
      throw new EngineError('Cannot build while any property in the group is mortgaged');
    }

    // Max houses check
    if (prop.houses >= MAX_HOUSES) {
      throw new EngineError('Property already has a hotel (max development)');
    }

    // Even building rule: can't build if this property has more houses
    // than any other property in the same group
    const minHouses = Math.min(...groupProps.map((p) => p.houses));
    if (prop.houses > minHouses) {
      throw new EngineError('Must build evenly — build on properties with fewer houses first');
    }

    const cost = cell.houseCost!;
    if (player.money < cost) {
      throw new EngineError(`Not enough money to build (need $${cost}, have $${player.money})`);
    }

    player.money -= cost;
    prop.houses++;

    return [
      this.makeEvent('house.built', {
        playerId: player.id,
        cellIndex,
        cellName: cell.name,
        houses: prop.houses,
        cost,
      }),
    ];
  }

  private handleSellHouse(cellIndex: number): GameEvent[] {
    const phase = this.state.phase.type;
    if (phase !== 'awaiting_roll' && phase !== 'turn_end') {
      throw new EngineError('Can only sell houses before rolling or before ending turn');
    }

    const player = this.currentPlayer();
    const cell = BOARD[cellIndex]!;

    if (cell.type !== 'property' || !cell.colorGroup) {
      throw new EngineError('Can only sell houses on color-group properties');
    }

    const prop = this.getProperty(cellIndex);
    if (!prop || prop.ownerId !== player.id) {
      throw new EngineError('You do not own this property');
    }

    if (prop.houses <= 0) {
      throw new EngineError('No houses to sell on this property');
    }

    // Even building rule in reverse: can't sell if other properties
    // in the group have more houses
    const groupCells = BOARD.filter((c) => c.colorGroup === cell.colorGroup);
    const groupProps = groupCells.map((c) => this.getProperty(c.index)!);
    const maxHouses = Math.max(...groupProps.map((p) => p.houses));
    if (prop.houses < maxHouses) {
      throw new EngineError('Must sell evenly — sell from properties with more houses first');
    }

    const revenue = Math.floor(cell.houseCost! / 2);
    player.money += revenue;
    prop.houses--;

    return [
      this.makeEvent('house.sold', {
        playerId: player.id,
        cellIndex,
        cellName: cell.name,
        houses: prop.houses,
        revenue,
      }),
    ];
  }

  // ── Helpers ────────────────────────────────────────────

  private currentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex]!;
  }

  private advanceToNextPlayer(): void {
    const n = this.state.players.length;
    let next = (this.state.currentPlayerIndex + 1) % n;
    let attempts = 0;
    while (this.state.players[next]!.isBankrupt && attempts < n) {
      next = (next + 1) % n;
      attempts++;
    }
    this.state.currentPlayerIndex = next;
  }

  private getProperty(cellIndex: number): PropertyState | undefined {
    return this.state.properties.find((p) => p.cellIndex === cellIndex);
  }

  private calculateRent(cell: Cell, prop: PropertyState): number {
    if (cell.type === 'railroad') {
      const ownerRailroads = this.state.properties.filter(
        (p) => p.ownerId === prop.ownerId && BOARD[p.cellIndex]!.type === 'railroad',
      ).length;
      return 25 * Math.pow(2, ownerRailroads - 1);
    }

    if (cell.type === 'utility') {
      const ownerUtilities = this.state.properties.filter(
        (p) => p.ownerId === prop.ownerId && BOARD[p.cellIndex]!.type === 'utility',
      ).length;
      const diceTotal = this.state.lastDice ? this.state.lastDice[0] + this.state.lastDice[1] : 7;
      return ownerUtilities === 1 ? 4 * diceTotal : 10 * diceTotal;
    }

    // Regular property — use rent table if available
    if (cell.rents && prop.houses > 0) {
      return cell.rents[prop.houses] ?? cell.rents[cell.rents.length - 1] ?? 0;
    }

    const baseRent = cell.rents?.[0] ?? cell.baseRent ?? 0;
    // Check monopoly (owns all in color group) — double base rent
    if (cell.colorGroup) {
      const groupCells = BOARD.filter((c) => c.colorGroup === cell.colorGroup);
      const ownsAll = groupCells.every((c) => {
        const p = this.getProperty(c.index);
        return p?.ownerId === prop.ownerId;
      });
      if (ownsAll && prop.houses === 0) {
        return baseRent * 2;
      }
    }
    return baseRent;
  }

  private sendToJail(player: Player): GameEvent[] {
    player.position = JAIL_POSITION;
    player.isInJail = true;
    player.jailTurns = 0;
    this.state.phase = { type: 'turn_end' };

    return [this.makeEvent('player.sentToJail', { playerId: player.id })];
  }

  private bankruptPlayer(player: Player): GameEvent[] {
    const events: GameEvent[] = [];
    player.isBankrupt = true;
    player.money = 0;

    // Release all properties
    for (const cellIdx of player.properties) {
      const prop = this.getProperty(cellIdx);
      if (prop) {
        prop.ownerId = null;
        prop.houses = 0;
        prop.isMortgaged = false;
      }
    }
    player.properties = [];

    events.push(
      this.makeEvent('player.bankrupt', { playerId: player.id, playerName: player.name }),
    );

    // Check game over
    const activePlayers = this.state.players.filter((p) => !p.isBankrupt);
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0]!;
      this.state.status = 'finished';
      this.state.phase = { type: 'game_over', winnerId: winner.id };
      events.push(
        this.makeEvent('game.ended', { winnerId: winner.id, winnerName: winner.name }),
      );
    } else {
      this.state.phase = { type: 'turn_end' };
    }

    return events;
  }

  private drawCard(player: Player, deckType: 'chance' | 'community_chest'): GameEvent[] {
    const events: GameEvent[] = [];
    // Simplified: random money gain/loss or go to jail
    const roll = this.rng.next();
    this.state.rngState = this.rng.getState();

    let description: string;
    let amount: number;

    if (deckType === 'chance') {
      if (roll < 0.15) {
        // Go to jail
        description = 'Go directly to Jail!';
        amount = 0;
        events.push(this.makeEvent('card.drawn', { playerId: player.id, deckType, description, amount }));
        events.push(...this.sendToJail(player));
        return events;
      } else if (roll < 0.5) {
        amount = this.rng.randInt(1, 5) * 25;
        this.state.rngState = this.rng.getState();
        description = `Bank pays you $${amount}`;
        player.money += amount;
      } else {
        const penalty = this.rng.randInt(1, 3) * 25;
        this.state.rngState = this.rng.getState();
        amount = -Math.min(penalty, player.money);
        description = `Pay $${penalty} for repairs`;
        player.money += amount;
      }
    } else {
      // Community Chest
      if (roll < 0.6) {
        amount = this.rng.randInt(1, 4) * 25;
        this.state.rngState = this.rng.getState();
        description = `Collect $${amount} from community`;
        player.money += amount;
      } else {
        const penalty = this.rng.randInt(1, 3) * 25;
        this.state.rngState = this.rng.getState();
        amount = -Math.min(penalty, player.money);
        description = `Pay $${penalty} community fee`;
        player.money += amount;
      }
    }

    events.push(this.makeEvent('card.drawn', { playerId: player.id, deckType, description, amount }));

    if (player.money <= 0) {
      events.push(...this.bankruptPlayer(player));
    } else {
      this.state.phase = { type: 'turn_end' };
    }

    return events;
  }

  private assertPhase(expected: string): void {
    if (this.state.phase.type !== expected) {
      throw new EngineError(`Expected phase '${expected}', got '${this.state.phase.type}'`);
    }
  }

  private makeEvent<T extends GameEvent['type']>(
    type: T,
    payload: Extract<GameEvent, { type: T }>['payload'],
  ): GameEvent {
    const event = {
      id: uuid(),
      ts: new Date().toISOString(),
      gameId: this.state.gameId,
      turn: this.state.turn,
      type,
      payload,
    } as GameEvent;
    this.state.lastEventId = event.id;
    return event;
  }
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
