import { useGameStream } from './hooks/useGameStream';
import { Board } from './components/Board';
import { PlayerInfo } from './components/PlayerInfo';
import { GameLog } from './components/GameLog';
import { Chat } from './components/Chat';
import { createGame, startGame, resetGame } from './api';

export function App() {
  const { state, events, connected, reload } = useGameStream();

  const handleNew = async () => {
    await createGame(['Alice', 'Bob', 'Charlie', 'Diana']);
    reload();
  };

  const handleStart = async () => {
    await startGame();
    reload();
  };

  const handleReset = async () => {
    await resetGame();
    reload();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Monopoly Arena</h1>
        <div className="header-controls">
          <span className={`status-dot ${connected ? 'on' : 'off'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
          {!state && <button onClick={handleNew}>New Game</button>}
          {state?.status === 'waiting' && <button onClick={handleStart}>Start Game</button>}
          {state && <button onClick={handleReset}>Reset</button>}
        </div>
      </header>

      {!state ? (
        <div className="no-game">
          <p>No game in progress. Click "New Game" to create one.</p>
        </div>
      ) : (
        <div className="game-layout">
          <div className="left-panel">
            <PlayerInfo state={state} />
            <Board state={state} />
          </div>
          <div className="right-panel">
            <GameLog events={events} />
            <Chat events={events} state={state} />
          </div>
        </div>
      )}
    </div>
  );
}
