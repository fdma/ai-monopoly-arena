import { useGameStream } from './hooks/useGameStream';
import { Board } from './components/Board';
import { Dashboard } from './components/Dashboard';
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
          <div className="connection-status">
            <span className={`status-dot ${connected ? 'on' : 'off'}`} />
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>
          {!state && <button onClick={handleNew}>New Game</button>}
          {state?.status === 'waiting' && <button onClick={handleStart}>Start Game</button>}
          {state && <button onClick={handleReset}>Reset</button>}
        </div>
      </header>

      {!state ? (
        <div className="no-game">
          <p>No game in progress.</p>
          <p>Click "New Game" to create one.</p>
        </div>
      ) : (
        <div className="game-layout">
          <Board state={state} events={events} />
          <Dashboard state={state} />
        </div>
      )}
    </div>
  );
}
