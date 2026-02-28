import { useRef, useEffect } from 'react';
import type { GameEvent } from '../types';

interface Props {
  events: GameEvent[];
}

function formatEvent(event: GameEvent): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'game.created':
      return `Game created with ${(p.players as unknown[]).length} players (seed: ${p.seed})`;
    case 'game.started':
      return 'Game started!';
    case 'turn.started':
      return `--- Turn ${event.turn}: ${p.playerName}'s turn ---`;
    case 'dice.rolled':
      return `Rolled [${(p.dice as number[])[0]}][${(p.dice as number[])[1]}] = ${p.total}${p.doubles ? ' (DOUBLES!)' : ''}`;
    case 'player.moved':
      return `Moved to ${p.cellName}${p.passedGo ? ' (passed GO!)' : ''}`;
    case 'go.collected':
      return `Collected $${p.amount} for passing GO`;
    case 'property.offered':
      return `${p.cellName} is available for $${p.price}`;
    case 'property.bought':
      return `Bought ${p.cellName} for $${p.price}`;
    case 'rent.paid':
      return `Paid $${p.amount} rent for ${p.cellName}`;
    case 'tax.paid':
      return `Paid $${p.amount} tax (${p.cellName})`;
    case 'card.drawn':
      return `Drew ${p.deckType}: ${p.description}`;
    case 'player.sentToJail':
      return 'Sent to Jail!';
    case 'player.releasedFromJail':
      return `Released from Jail (${p.method})`;
    case 'auction.started':
      return `Auction started for ${p.cellName}`;
    case 'auction.bidPlaced':
      return `Bid: $${p.amount}`;
    case 'auction.ended':
      return p.winnerId
        ? `${p.winnerName} won auction for ${p.cellName} at $${p.amount}`
        : `No bids — ${p.cellName} remains unowned`;
    case 'house.built': {
      const h = p.houses as number;
      return `Built ${h === 5 ? 'HOTEL' : `house #${h}`} on ${p.cellName} ($${p.cost})`;
    }
    case 'house.sold':
      return `Sold house on ${p.cellName} (+$${p.revenue})`;
    case 'player.bankrupt':
      return `${p.playerName} went BANKRUPT!`;
    case 'game.ended':
      return `GAME OVER — ${p.winnerName} wins!`;
    default:
      return `${event.type}: ${JSON.stringify(p)}`;
  }
}

export function GameLog({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const gameEvents = events.filter((e) => !e.type.startsWith('chat.'));

  return (
    <div className="game-log">
      <h3>Game Log</h3>
      <div className="log-entries">
        {gameEvents.map((e) => (
          <div key={e.id} className={`log-entry event-${e.type.replace('.', '-')}`}>
            <span className="log-text">{formatEvent(e)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
