/**
 * Demo Dealer — simulates 4 bot players playing a full game.
 * Usage: pnpm dealer  (or: npx tsx scripts/demoDealer.ts)
 *
 * Each bot uses simple heuristics:
 * - Buy if affordable and price < 60% of cash
 * - Otherwise pass and submit auction bids
 * - Pay jail fine if can afford
 * - Build houses when owning a monopoly and can afford
 * - Send occasional chat messages
 */

const API = process.env.API_URL ?? 'http://localhost:3001';

interface Player {
  id: string;
  name: string;
  money: number;
  isBankrupt: boolean;
  properties: number[];
}

interface PropertyState {
  cellIndex: number;
  ownerId: string | null;
  houses: number;
  isMortgaged: boolean;
}

interface GameState {
  gameId: string;
  status: string;
  turn: number;
  currentPlayerIndex: number;
  players: Player[];
  properties: PropertyState[];
  phase: { type: string; cellIndex?: number; price?: number };
}

// Board color groups (property cell indices by group)
const COLOR_GROUPS: Record<string, { cells: number[]; houseCost: number }> = {
  brown: { cells: [1, 3], houseCost: 50 },
  lightBlue: { cells: [6, 8, 9], houseCost: 50 },
  pink: { cells: [11, 13, 14], houseCost: 100 },
  orange: { cells: [16, 18, 19], houseCost: 100 },
  red: { cells: [21, 23, 24], houseCost: 150 },
  yellow: { cells: [26, 27, 29], houseCost: 150 },
  green: { cells: [31, 32, 34], houseCost: 200 },
  darkBlue: { cells: [37, 39], houseCost: 200 },
};

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<T>;
}

async function getState(): Promise<GameState | null> {
  const res = await api<{ ok: boolean; data?: GameState }>('/api/state');
  return res.ok ? res.data! : null;
}

async function action(gameId: string, playerId: string, act: Record<string, unknown>) {
  return api<{ ok: boolean; error?: string }>('/api/action', { gameId, playerId, action: act });
}

async function chat(gameId: string, player: Player, text: string) {
  await api('/api/chat', {
    gameId,
    from: { kind: 'player', id: player.id, name: player.name },
    scope: 'tabletalk',
    text,
  });
}

const QUIPS = [
  'Interesting move...',
  'I love this property!',
  'Running low on cash...',
  'To the moon!',
  'Not my best turn.',
  'Pay up!',
  'This is fine.',
  'Going for the monopoly!',
  'Jail again?!',
  'Easy money.',
  'Time to build!',
  'Hotel incoming!',
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Try to build houses on monopolies the current player owns */
async function tryBuildHouses(gameId: string, state: GameState): Promise<number> {
  const player = state.players[state.currentPlayerIndex]!;
  let built = 0;

  for (const [groupName, group] of Object.entries(COLOR_GROUPS)) {
    // Check if player owns all properties in this group
    const ownsAll = group.cells.every((cellIdx) => {
      const prop = state.properties.find((p) => p.cellIndex === cellIdx);
      return prop?.ownerId === player.id;
    });
    if (!ownsAll) continue;

    // Build evenly: find the property with the fewest houses and build there
    // Repeat while we can afford it and haven't maxed out
    let keepBuilding = true;
    while (keepBuilding) {
      // Re-fetch state to get updated money and house counts
      const freshState = await getState();
      if (!freshState) break;
      const freshPlayer = freshState.players[freshState.currentPlayerIndex]!;

      if (freshPlayer.money < group.houseCost + 100) break; // Keep $100 reserve

      const groupProps = group.cells.map((cellIdx) =>
        freshState.properties.find((p) => p.cellIndex === cellIdx)!,
      );

      // Find property with fewest houses that isn't maxed
      const minHouses = Math.min(...groupProps.map((p) => p.houses));
      if (minHouses >= 5) break; // All hotels

      const buildTarget = groupProps.find((p) => p.houses === minHouses && p.houses < 5);
      if (!buildTarget) break;

      const result = await action(gameId, freshPlayer.id, {
        type: 'BUILD_HOUSE',
        cellIndex: buildTarget.cellIndex,
      });

      if (result.ok) {
        built++;
        if (built % 3 === 0) {
          await sleep(20);
        }
      } else {
        keepBuilding = false;
      }
    }
  }

  return built;
}

async function main() {
  console.log('=== Demo Dealer: AI Monopoly Arena ===\n');

  // Reset any existing game
  await api('/api/game/reset', {});

  // Create game
  const createRes = await api<{ ok: boolean; data: { gameId: string; players: Player[] } }>(
    '/api/game/new',
    { playerNames: ['Alice', 'Bob', 'Charlie', 'Diana'], playerCount: 4, seed: 42 },
  );
  const gameId = createRes.data.gameId;
  console.log(`Game created: ${gameId}`);
  console.log(`Players: ${createRes.data.players.map((p) => p.name).join(', ')}\n`);

  // Start game
  await api('/api/game/start', {});
  console.log('Game started!\n');

  let turnCount = 0;
  const MAX_TURNS = 500;

  while (turnCount < MAX_TURNS) {
    const state = await getState();
    if (!state || state.status === 'finished') {
      console.log('\n=== GAME OVER ===');
      if (state) {
        const winner = state.players.find((p) => !p.isBankrupt);
        if (winner) console.log(`Winner: ${winner.name}!`);
        for (const p of state.players) {
          console.log(`  ${p.name}: $${p.money} ${p.isBankrupt ? '(BANKRUPT)' : ''}`);
        }
      }
      break;
    }

    const currentPlayer = state.players[state.currentPlayerIndex]!;
    const phase = state.phase;

    try {
      switch (phase.type) {
        case 'awaiting_roll': {
          // Try building houses before rolling
          const built = await tryBuildHouses(gameId, state);
          if (built > 0) {
            console.log(`  ${currentPlayer.name} built ${built} house(s)`);
          }
          console.log(`[Turn ${state.turn}] ${currentPlayer.name} rolls...`);
          await action(gameId, currentPlayer.id, { type: 'ROLL_DICE' });
          break;
        }

        case 'awaiting_buy_decision': {
          const price = phase.price ?? 0;
          const shouldBuy = currentPlayer.money > 0 && price < currentPlayer.money * 0.6;
          if (shouldBuy) {
            console.log(`  ${currentPlayer.name} BUYS for $${price}`);
            await action(gameId, currentPlayer.id, { type: 'BUY' });
          } else {
            console.log(`  ${currentPlayer.name} PASSES on $${price}`);
            await action(gameId, currentPlayer.id, { type: 'PASS' });
          }
          break;
        }

        case 'awaiting_auction_bids': {
          const bids: Record<string, number> = {};
          for (const p of state.players) {
            if (p.isBankrupt || p.id === currentPlayer.id) continue;
            const maxBid = Math.floor(p.money * 0.3);
            bids[p.id] = maxBid > 10 ? maxBid : 0;
          }
          bids[currentPlayer.id] = 0;
          console.log(`  Auction bids submitted`);
          await action(gameId, currentPlayer.id, { type: 'SUBMIT_AUCTION_BIDS', bids });
          break;
        }

        case 'awaiting_jail_decision': {
          if (currentPlayer.money >= 50) {
            console.log(`  ${currentPlayer.name} pays jail fine`);
            await action(gameId, currentPlayer.id, { type: 'PAY_JAIL_FINE' });
          } else {
            console.log(`  ${currentPlayer.name} tries to roll doubles`);
            await action(gameId, currentPlayer.id, { type: 'ROLL_JAIL_DOUBLES' });
          }
          break;
        }

        case 'turn_end': {
          // Try building houses before ending turn
          const built = await tryBuildHouses(gameId, state);
          if (built > 0) {
            console.log(`  ${currentPlayer.name} built ${built} house(s)`);
          }

          await action(gameId, currentPlayer.id, { type: 'END_TURN' });
          turnCount++;

          // Occasional chat
          if (turnCount % 5 === 0) {
            const quip = QUIPS[turnCount % QUIPS.length]!;
            await chat(gameId, currentPlayer, quip);
          }
          break;
        }

        case 'game_over': {
          console.log('\n=== GAME OVER ===');
          const finalState = await getState();
          if (finalState) {
            for (const p of finalState.players) {
              console.log(`  ${p.name}: $${p.money} ${p.isBankrupt ? '(BANKRUPT)' : ''}`);
            }
          }
          return;
        }

        default:
          console.log(`  Unknown phase: ${phase.type}`);
          return;
      }
    } catch (err) {
      console.error(`Error:`, err);
      return;
    }

    await sleep(30);
  }

  if (turnCount >= MAX_TURNS) {
    console.log(`\nReached ${MAX_TURNS} turns limit.`);
    const finalState = await getState();
    if (finalState) {
      console.log('Final standings:');
      for (const p of finalState.players) {
        const totalHouses = finalState.properties
          .filter((pr) => pr.ownerId === p.id)
          .reduce((sum, pr) => sum + pr.houses, 0);
        console.log(`  ${p.name}: $${p.money}, ${p.properties.length} props, ${totalHouses} houses ${p.isBankrupt ? '(BANKRUPT)' : ''}`);
      }
    }
  }
}

main().catch(console.error);
