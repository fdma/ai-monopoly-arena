import { useState, useRef, useEffect } from 'react';
import type { GameEvent, GameState } from '../types';
import { sendChat } from '../api';

interface Props {
  events: GameEvent[];
  state: GameState;
}

type Tab = 'public' | 'tabletalk' | 'private';

export function Chat({ events, state }: Props) {
  const [tab, setTab] = useState<Tab>('public');
  const [text, setText] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>(state.players[0]?.id ?? '');
  const [privateTarget, setPrivateTarget] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const chatEvents = events.filter((e) => {
    if (tab === 'public') return e.type === 'chat.public';
    if (tab === 'tabletalk') return e.type === 'chat.tabletalk';
    if (tab === 'private') return e.type === 'chat.private';
    return false;
  });

  const handleSend = async () => {
    if (!text.trim() || !state.gameId) return;
    const from = {
      kind: 'player' as const,
      id: selectedPlayer,
      name: state.players.find((p) => p.id === selectedPlayer)?.name,
    };
    await sendChat(
      state.gameId,
      from,
      tab,
      text.trim(),
      tab === 'private' ? privateTarget : undefined,
    );
    setText('');
  };

  return (
    <div className="chat">
      <h3>Chat</h3>
      <div className="chat-tabs">
        {(['public', 'tabletalk', 'private'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`chat-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="chat-messages">
        {chatEvents.map((e) => {
          const p = e.payload as Record<string, unknown>;
          const from = p.from as { name?: string; kind: string } | undefined;
          return (
            <div key={e.id} className="chat-msg">
              <strong>{from?.name ?? from?.kind ?? '???'}:</strong> {p.text as string}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input">
        <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
          {state.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {tab === 'private' && (
          <select value={privateTarget} onChange={(e) => setPrivateTarget(e.target.value)}>
            <option value="">To...</option>
            {state.players
              .filter((p) => p.id !== selectedPlayer)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
