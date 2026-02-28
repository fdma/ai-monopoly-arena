import type { GameState } from '../types';
import { BOARD } from '../board-data';

interface Props {
  state: GameState;
}

function phaseLabel(state: GameState): string {
  const phase = state.phase;
  const currentPlayer = state.players[state.currentPlayerIndex];
  switch (phase.type) {
    case 'pre_game':
      return 'Waiting to start...';
    case 'awaiting_roll':
      return `${currentPlayer?.name}: Roll dice`;
    case 'awaiting_buy_decision': {
      const cell = BOARD[phase.cellIndex];
      return `${currentPlayer?.name}: Buy ${cell?.name} ($${phase.price})?`;
    }
    case 'awaiting_auction_bids': {
      const cell = BOARD[phase.cellIndex];
      return `Auction for ${cell?.name}`;
    }
    case 'awaiting_jail_decision':
      return `${currentPlayer?.name}: In Jail — Pay fine or roll doubles`;
    case 'turn_end':
      return `${currentPlayer?.name}: End turn`;
    case 'game_over':
      return `Game over! Winner: ${state.players.find((p) => p.id === phase.winnerId)?.name}`;
  }
}

export function PlayerInfo({ state }: Props) {
  return (
    <div className="player-info">
      <div className="phase-label">
        <strong>Turn {state.turn}</strong> — {phaseLabel(state)}
        {state.lastDice && (
          <span className="dice">
            {' '}[{state.lastDice[0]}][{state.lastDice[1]}]
          </span>
        )}
      </div>
      <div className="players-list">
        {state.players.map((p, i) => (
          <div
            key={p.id}
            className={`player-row ${p.isBankrupt ? 'bankrupt' : ''} ${i === state.currentPlayerIndex ? 'current' : ''}`}
          >
            <span className="player-dot" style={{ backgroundColor: p.color }} />
            <span className="player-name">{p.name}</span>
            <span className="player-money">${p.money}</span>
            <span className="player-props">{p.properties.length} props</span>
            {p.isInJail && <span className="jail-badge">JAIL</span>}
            {p.isBankrupt && <span className="bankrupt-badge">BANKRUPT</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
