/**
 * Demo Dealer — simulates 4 bot players playing a full game.
 * Usage: pnpm dealer  (or: npx tsx scripts/demoDealer.ts)
 *
 * Each bot uses simple heuristics:
 * - Buy if affordable and price < 60% of cash
 * - Otherwise pass and submit auction bids
 * - Pay jail fine if can afford
 * - Build houses when owning a monopoly and can afford
 * - Frequently chat with each other
 */

const API = process.env.API_URL ?? 'http://localhost:3001';
const TURN_DELAY = 800; // ms between actions — slow enough to watch

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

async function chat(gameId: string, player: Player, text: string, scope: 'public' | 'tabletalk' = 'tabletalk') {
  await api('/api/chat', {
    gameId,
    from: { kind: 'player', id: player.id, name: player.name },
    scope,
    text,
  });
}

// ── Chat lines per situation ──────────────────────────
const CHAT_BUY = [
  'This property is mine now!',
  'Great investment!',
  'Adding to my portfolio.',
  'Nobody else gets this one.',
  'Smart money moves.',
  'This will pay off big time!',
  'Another one for the collection.',
];

const CHAT_PASS = [
  'Not worth it right now.',
  'Too expensive for me...',
  'I\'ll pass, thanks.',
  'Saving my cash for something better.',
  'Nah, not interested.',
];

const CHAT_RENT = [
  'Ouch, that hurts!',
  'Take my money then...',
  'Rent is too damn high!',
  'You\'re bleeding me dry!',
  'I\'ll remember this.',
  'Painful...',
];

const CHAT_RENT_RECEIVED = [
  'Pay up!',
  'Easy money!',
  'Ka-ching!',
  'Thanks for stopping by!',
  'Rent is due, friend.',
  'My properties are printing money.',
];

const CHAT_JAIL = [
  'Not jail again!',
  'I\'m innocent, I swear!',
  'This cell is getting familiar...',
  'Visiting my second home.',
  'Behind bars once more.',
];

const CHAT_ROLL = [
  'Come on, lucky dice!',
  'Let\'s see what we get...',
  'Big roll incoming!',
  'Feeling lucky!',
  'Here goes nothing.',
  'Roll the dice!',
];

const CHAT_BUILD = [
  'Time to develop!',
  'Construction crew incoming!',
  'Building up the empire.',
  'Houses make money.',
  'Improving the neighborhood.',
];

const CHAT_GENERAL = [
  'Good game so far!',
  'Anyone want to make a deal?',
  'The board is heating up.',
  'Competition is fierce today.',
  'This game is getting interesting...',
  'May the best investor win!',
  'Watch and learn, everyone.',
  'I have a strategy...',
  'Don\'t underestimate me.',
  'Just warming up!',
];

const CHAT_LOW_MONEY = [
  'Running dangerously low...',
  'Need to be careful now.',
  'My wallet is crying.',
  'Tough times.',
  'Counting every dollar.',
];

const CHAT_WINNING = [
  'Looking good for me!',
  'Who wants to surrender?',
  'I like my chances.',
  'This is my game to lose.',
  'Empire is growing!',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Try to build houses on monopolies the current player owns */
async function tryBuildHouses(gameId: string, state: GameState): Promise<number> {
  const player = state.players[state.currentPlayerIndex]!;
  let built = 0;

  for (const [, group] of Object.entries(COLOR_GROUPS)) {
    const ownsAll = group.cells.every((cellIdx) => {
      const prop = state.properties.find((p) => p.cellIndex === cellIdx);
      return prop?.ownerId === player.id;
    });
    if (!ownsAll) continue;

    let keepBuilding = true;
    while (keepBuilding) {
      const freshState = await getState();
      if (!freshState) break;
      const freshPlayer = freshState.players[freshState.currentPlayerIndex]!;

      if (freshPlayer.money < group.houseCost + 100) break;

      const groupProps = group.cells.map((cellIdx) =>
        freshState.properties.find((p) => p.cellIndex === cellIdx)!,
      );

      const minHouses = Math.min(...groupProps.map((p) => p.houses));
      if (minHouses >= 5) break;

      const buildTarget = groupProps.find((p) => p.houses === minHouses && p.houses < 5);
      if (!buildTarget) break;

      const result = await action(gameId, freshPlayer.id, {
        type: 'BUILD_HOUSE',
        cellIndex: buildTarget.cellIndex,
      });

      if (result.ok) {
        built++;
        await sleep(300);
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
  let lastRentPayerId: string | null = null;

  while (turnCount < MAX_TURNS) {
    const state = await getState();
    if (!state || state.status === 'finished') {
      console.log('\n=== GAME OVER ===');
      if (state) {
        const winner = state.players.find((p) => !p.isBankrupt);
        if (winner) {
          console.log(`Winner: ${winner.name}!`);
          await chat(gameId, winner, 'GG everyone! Victory is mine!', 'public');
        }
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
            await chat(gameId, currentPlayer, pick(CHAT_BUILD));
            await sleep(TURN_DELAY);
          }

          // Occasional pre-roll chat
          if (Math.random() < 0.3) {
            if (currentPlayer.money < 200) {
              await chat(gameId, currentPlayer, pick(CHAT_LOW_MONEY));
            } else if (currentPlayer.money > 1000) {
              await chat(gameId, currentPlayer, pick(CHAT_WINNING));
            } else {
              await chat(gameId, currentPlayer, pick(CHAT_ROLL));
            }
            await sleep(TURN_DELAY);
          }

          console.log(`[Turn ${state.turn}] ${currentPlayer.name} rolls...`);
          await action(gameId, currentPlayer.id, { type: 'ROLL_DICE' });
          await sleep(TURN_DELAY);
          break;
        }

        case 'awaiting_buy_decision': {
          const price = phase.price ?? 0;
          const shouldBuy = currentPlayer.money > 0 && price < currentPlayer.money * 0.6;
          if (shouldBuy) {
            console.log(`  ${currentPlayer.name} BUYS for $${price}`);
            await action(gameId, currentPlayer.id, { type: 'BUY' });
            await chat(gameId, currentPlayer, pick(CHAT_BUY));
          } else {
            console.log(`  ${currentPlayer.name} PASSES on $${price}`);
            await action(gameId, currentPlayer.id, { type: 'PASS' });
            if (Math.random() < 0.5) {
              await chat(gameId, currentPlayer, pick(CHAT_PASS));
            }
          }
          await sleep(TURN_DELAY);
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
          await sleep(TURN_DELAY);
          break;
        }

        case 'awaiting_jail_decision': {
          await chat(gameId, currentPlayer, pick(CHAT_JAIL));
          await sleep(TURN_DELAY);

          if (currentPlayer.money >= 50) {
            console.log(`  ${currentPlayer.name} pays jail fine`);
            await action(gameId, currentPlayer.id, { type: 'PAY_JAIL_FINE' });
          } else {
            console.log(`  ${currentPlayer.name} tries to roll doubles`);
            await action(gameId, currentPlayer.id, { type: 'ROLL_JAIL_DOUBLES' });
          }
          await sleep(TURN_DELAY);
          break;
        }

        case 'turn_end': {
          // Check if rent was paid this turn — react
          const freshState = await getState();
          if (freshState) {
            // Look for rent payer via money changes
            for (const p of freshState.players) {
              if (p.id !== currentPlayer.id && !p.isBankrupt) {
                // The owner might want to gloat
                const ownedProps = freshState.properties.filter((pr) => pr.ownerId === p.id);
                if (ownedProps.length > 0 && lastRentPayerId === currentPlayer.id && Math.random() < 0.4) {
                  await chat(gameId, p, pick(CHAT_RENT_RECEIVED));
                  await sleep(TURN_DELAY);
                  break;
                }
              }
            }
          }

          // Try building houses before ending turn
          const built = await tryBuildHouses(gameId, state);
          if (built > 0) {
            console.log(`  ${currentPlayer.name} built ${built} house(s)`);
            await chat(gameId, currentPlayer, pick(CHAT_BUILD));
            await sleep(TURN_DELAY);
          }

          // General chit-chat
          if (Math.random() < 0.2) {
            await chat(gameId, currentPlayer, pick(CHAT_GENERAL));
            await sleep(TURN_DELAY);
          }

          await action(gameId, currentPlayer.id, { type: 'END_TURN' });
          turnCount++;
          lastRentPayerId = null;
          await sleep(TURN_DELAY / 2);
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
