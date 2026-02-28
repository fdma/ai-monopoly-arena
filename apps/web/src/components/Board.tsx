import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BOARD, COLOR_MAP } from '../board-data';
import type { GameState, GameEvent, Player, PropertyState } from '../types';
import { getCellIcon } from './CellIcons';
import './Board.css';

interface Props {
  state: GameState;
  events: GameEvent[];
}

interface ChatBubble {
  playerId: string;
  playerName: string;
  text: string;
  ts: number;
}

interface DiceRoll {
  dice: [number, number];
  doubles: boolean;
  playerId: string;
  ts: number;
}

interface MoneyPopup {
  id: string;
  playerId: string;
  amount: number; // positive = gain, negative = loss
  label: string;  // e.g. "+$200" or "-$150 rent"
  ts: number;
}

const BUBBLE_DURATION = 5000;
const DICE_DURATION = 1800;
const MONEY_POPUP_DURATION = 2200;
const GRID_SIZE = 11;
const TOKEN_MOVE_DURATION = 500;
const CORNERS = new Set([0, 10, 20, 30]);

function getCellPosition(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 10, col: 10 - index };
  if (index <= 19) return { row: 10 - (index - 10), col: 0 };
  if (index <= 30) return { row: 0, col: index - 20 };
  return { row: index - 30, col: 10 };
}

// Pre-compute static board grid (never changes)
const STATIC_GRID: (number | null)[][] = Array.from({ length: GRID_SIZE }, () =>
  Array.from({ length: GRID_SIZE }, () => null),
);
for (let i = 0; i < 40; i++) {
  const { row, col } = getCellPosition(i);
  STATIC_GRID[row]![col] = i;
}

// Circular offset for 1–8 tokens on the same cell
const TOKEN_OFFSETS: { x: number; y: number }[][] = [
  [{ x: 0, y: 0 }],
  [{ x: -1.2, y: -0.3 }, { x: 1.2, y: -0.3 }],
  [{ x: -1.2, y: -0.8 }, { x: 1.2, y: -0.8 }, { x: 0, y: 1 }],
  [{ x: -1.2, y: -0.8 }, { x: 1.2, y: -0.8 }, { x: -1.2, y: 1 }, { x: 1.2, y: 1 }],
  [{ x: -1.5, y: -1 }, { x: 1.5, y: -1 }, { x: 0, y: 0 }, { x: -1.5, y: 1 }, { x: 1.5, y: 1 }],
  [{ x: -1.5, y: -1 }, { x: 0, y: -1 }, { x: 1.5, y: -1 }, { x: -1.5, y: 1 }, { x: 0, y: 1 }, { x: 1.5, y: 1 }],
  [{ x: -1.5, y: -1.2 }, { x: 0, y: -1.2 }, { x: 1.5, y: -1.2 }, { x: -1.5, y: 0.2 }, { x: 1.5, y: 0.2 }, { x: -1.5, y: 1.4 }, { x: 1.5, y: 1.4 }],
  [{ x: -1.5, y: -1.2 }, { x: 0, y: -1.2 }, { x: 1.5, y: -1.2 }, { x: -1.5, y: 0.2 }, { x: 1.5, y: 0.2 }, { x: -1.5, y: 1.4 }, { x: 0, y: 1.4 }, { x: 1.5, y: 1.4 }],
];

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function HouseIndicator({ houses }: { houses: number }) {
  if (houses === 0) return null;
  if (houses === 5) {
    return <div className="houses hotel" title="Hotel">H</div>;
  }
  return (
    <div className="houses" title={`${houses} house${houses > 1 ? 's' : ''}`}>
      {Array.from({ length: houses }, (_, i) => <span key={i} className="house-dot" />)}
    </div>
  );
}

function DiceFace({ value, isDoubles }: { value: number; isDoubles: boolean }) {
  return (
    <div className={`dice-face ${isDoubles ? 'dice-doubles' : ''}`}>
      <div className={`dice-dots dice-val-${value}`}>
        {Array.from({ length: value }, (_, i) => (
          <span key={i} className="dice-dot" />
        ))}
      </div>
    </div>
  );
}

export function Board({ state, events }: Props) {
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [diceRoll, setDiceRoll] = useState<DiceRoll | null>(null);
  const [moneyPopups, setMoneyPopups] = useState<MoneyPopup[]>([]);
  const processedRef = useRef<Set<string>>(new Set());
  const diceProcessedRef = useRef<Set<string>>(new Set());
  const moneyProcessedRef = useRef<Set<string>>(new Set());
  const prevPositionsRef = useRef<Record<string, number>>({});
  const [tokenPositions, setTokenPositions] = useState<Record<string, { leftPct: number; topPct: number; animate: boolean }>>({});
  const pendingPositionsRef = useRef<{ players: Player[] } | null>(null);
  const diceActiveRef = useRef(false);

  // Build property lookup map once per render
  const propMap = useMemo(() => {
    const m = new Map<number, PropertyState>();
    for (const p of state.properties) m.set(p.cellIndex, p);
    return m;
  }, [state.properties]);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of state.players) m.set(p.id, p);
    return m;
  }, [state.players]);

  // Track new chat events and create bubbles (public + tabletalk only)
  useEffect(() => {
    const chatEvents = events.filter(
      (e) => e.type === 'chat.public' || e.type === 'chat.tabletalk',
    );

    const newBubbles: ChatBubble[] = [];
    for (const e of chatEvents) {
      if (processedRef.current.has(e.id)) continue;
      processedRef.current.add(e.id);

      const p = e.payload as Record<string, unknown>;
      const from = p.from as { id?: string; name?: string; kind: string } | undefined;
      if (from?.kind === 'player' && from.id) {
        newBubbles.push({
          playerId: from.id,
          playerName: from.name ?? 'Player',
          text: p.text as string,
          ts: Date.now(),
        });
      }
    }

    if (newBubbles.length > 0) {
      setBubbles((prev) => {
        const map = new Map<string, ChatBubble>();
        for (const b of prev) map.set(b.playerId, b);
        for (const b of newBubbles) map.set(b.playerId, b);
        return Array.from(map.values());
      });
    }
  }, [events]);

  // Auto-remove expired bubbles
  useEffect(() => {
    if (bubbles.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setBubbles((prev) => prev.filter((b) => now - b.ts < BUBBLE_DURATION));
    }, 500);
    return () => clearInterval(timer);
  }, [bubbles.length]);

  // Track money events and create popups
  useEffect(() => {
    const MONEY_EVENTS = new Set([
      'go.collected', 'rent.paid', 'tax.paid', 'property.bought',
      'auction.ended', 'house.built', 'card.drawn',
    ]);
    const moneyEvents = events.filter((e) => MONEY_EVENTS.has(e.type));
    const newPopups: MoneyPopup[] = [];

    for (const e of moneyEvents) {
      if (moneyProcessedRef.current.has(e.id)) continue;
      moneyProcessedRef.current.add(e.id);

      const p = e.payload as Record<string, unknown>;
      const now = Date.now();

      switch (e.type) {
        case 'go.collected':
          newPopups.push({ id: e.id, playerId: p.playerId as string, amount: p.amount as number, label: `+$${p.amount}`, ts: now });
          break;
        case 'rent.paid':
          newPopups.push({ id: e.id + '-from', playerId: p.fromPlayerId as string, amount: -(p.amount as number), label: `-$${p.amount} rent`, ts: now });
          newPopups.push({ id: e.id + '-to', playerId: p.toPlayerId as string, amount: p.amount as number, label: `+$${p.amount} rent`, ts: now });
          break;
        case 'tax.paid':
          newPopups.push({ id: e.id, playerId: p.playerId as string, amount: -(p.amount as number), label: `-$${p.amount} tax`, ts: now });
          break;
        case 'property.bought':
          newPopups.push({ id: e.id, playerId: p.playerId as string, amount: -(p.price as number), label: `-$${p.price}`, ts: now });
          break;
        case 'auction.ended':
          if (p.winnerId) {
            newPopups.push({ id: e.id, playerId: p.winnerId as string, amount: -(p.amount as number), label: `-$${p.amount}`, ts: now });
          }
          break;
        case 'house.built':
          newPopups.push({ id: e.id, playerId: p.playerId as string, amount: -(p.cost as number), label: `-$${p.cost}`, ts: now });
          break;
        case 'card.drawn': {
          const amt = p.amount as number | undefined;
          if (amt && amt !== 0) {
            const pid = p.playerId as string;
            newPopups.push({ id: e.id, playerId: pid, amount: amt, label: amt > 0 ? `+$${amt}` : `-$${Math.abs(amt)}`, ts: now });
          }
          break;
        }
      }
    }

    if (newPopups.length > 0) {
      setMoneyPopups((prev) => [...prev, ...newPopups]);
    }
  }, [events]);

  // Auto-remove expired money popups
  useEffect(() => {
    if (moneyPopups.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setMoneyPopups((prev) => prev.filter((p) => now - p.ts < MONEY_POPUP_DURATION));
    }, 300);
    return () => clearInterval(timer);
  }, [moneyPopups.length]);

  // Compute token positions from a player list (stable — only uses refs + setState)
  const applyTokenPositions = useCallback((players: Player[]) => {
    const newPositions: Record<string, { leftPct: number; topPct: number; animate: boolean }> = {};
    const groups: Record<number, Player[]> = {};
    for (const p of players) {
      if (p.isBankrupt) continue;
      (groups[p.position] ??= []).push(p);
    }
    for (const [, group] of Object.entries(groups)) {
      const offsets = TOKEN_OFFSETS[Math.min(group.length, TOKEN_OFFSETS.length) - 1]!;
      for (let i = 0; i < group.length; i++) {
        const p = group[i]!;
        const { row, col } = getCellPosition(p.position);
        const off = offsets[i] ?? { x: 0, y: 0 };
        const leftPct = ((col + 0.5) / GRID_SIZE) * 100 + off.x;
        const topPct = ((row + 0.5) / GRID_SIZE) * 100 + off.y;
        const prevPos = prevPositionsRef.current[p.id];
        const animate = prevPos !== undefined && prevPos !== p.position;
        newPositions[p.id] = { leftPct, topPct, animate };
      }
    }
    prevPositionsRef.current = Object.fromEntries(
      players.filter((p) => !p.isBankrupt).map((p) => [p.id, p.position]),
    );
    setTokenPositions(newPositions);
  }, []);

  // Track dice.rolled events — skip if one is already showing
  useEffect(() => {
    const diceEvents = events.filter((e) => e.type === 'dice.rolled');
    for (const e of diceEvents) {
      if (diceProcessedRef.current.has(e.id)) continue;
      diceProcessedRef.current.add(e.id);
      if (diceActiveRef.current) continue; // don't overwrite current animation
      const p = e.payload as Record<string, unknown>;
      diceActiveRef.current = true;
      setDiceRoll({
        dice: p.dice as [number, number],
        doubles: p.doubles as boolean,
        playerId: (p.playerId as string) ?? '',
        ts: Date.now(),
      });
    }
  }, [events]);

  // Auto-hide dice, then flush pending token move
  useEffect(() => {
    if (!diceRoll) return;
    const timer = setTimeout(() => {
      diceActiveRef.current = false;
      setDiceRoll(null);
      const pending = pendingPositionsRef.current;
      if (pending) {
        pendingPositionsRef.current = null;
        applyTokenPositions(pending.players);
      }
    }, DICE_DURATION);
    return () => clearTimeout(timer);
  }, [diceRoll, applyTokenPositions]);

  // Track token positions — queue if dice is rolling
  useEffect(() => {
    if (diceActiveRef.current) {
      pendingPositionsRef.current = { players: state.players };
    } else {
      applyTokenPositions(state.players);
    }
  }, [state.players, applyTokenPositions]);

  // Build overlay bubbles with percentage positions
  const overlayBubbles = useMemo(() => {
    const result: { bubble: ChatBubble; leftPct: number; topPct: number }[] = [];
    for (const b of bubbles) {
      const player = playerMap.get(b.playerId);
      if (!player || player.isBankrupt) continue;
      const { row, col } = getCellPosition(player.position);
      result.push({
        bubble: b,
        leftPct: ((col + 0.5) / GRID_SIZE) * 100,
        topPct: ((row + 0.5) / GRID_SIZE) * 100,
      });
    }
    return result;
  }, [bubbles, playerMap]);

  // Dice roller info
  const roller = diceRoll
    ? (playerMap.get(diceRoll.playerId) ?? state.players[state.currentPlayerIndex])
    : null;

  return (
    <div className="board-wrapper">
      <div className="board">
        {STATIC_GRID.map((row, ri) => (
          <div key={ri} className="board-row">
            {row.map((cellIdx, ci) => {
              if (cellIdx === null) {
                if (ri === 0 || ri === 10 || ci === 0 || ci === 10) {
                  return <div key={ci} className="board-cell empty" />;
                }
                if (ri === 5 && ci === 5) {
                  return (
                    <div key={ci} className="board-center">
                      <div className="center-title">MONOPOLY</div>
                      <div className="center-sub">AI Arena</div>
                    </div>
                  );
                }
                return <div key={ci} className="board-inner" />;
              }

              const cell = BOARD[cellIdx]!;
              const isCorner = CORNERS.has(cellIdx);
              const isProperty = cell.type === 'property';
              const colorBg = cell.colorGroup ? COLOR_MAP[cell.colorGroup] : undefined;
              const prop = propMap.get(cellIdx);
              const ownerColor = prop?.ownerId ? (playerMap.get(prop.ownerId)?.color ?? null) : null;
              const houses = prop?.houses ?? 0;
              const cellClass = [
                'board-cell',
                isCorner ? 'corner' : '',
                `cell-type-${cell.type}`,
              ].filter(Boolean).join(' ');

              const icon = !isProperty ? getCellIcon(cell.type, cell.name, isCorner ? 20 : 14) : null;

              return (
                <div
                  key={ci}
                  className={cellClass}
                  title={`${cell.name}${cell.price ? ` ($${cell.price})` : ''}${houses > 0 ? ` [${houses === 5 ? 'Hotel' : houses + 'H'}]` : ''}`}
                >
                  {colorBg && <div className="color-strip" style={{ backgroundColor: colorBg }} />}
                  <HouseIndicator houses={houses} />
                  {icon && <div className="cell-svg">{icon}</div>}
                  <div className="cell-name">{cell.name}</div>
                  {isProperty && cell.price && (
                    <div className="cell-price">${cell.price}</div>
                  )}
                  {(cell.type === 'railroad' || cell.type === 'utility') && cell.price && (
                    <div className="cell-price">${cell.price}</div>
                  )}
                  {cell.type === 'tax' && cell.price && (
                    <div className="cell-price tax-price">-${cell.price}</div>
                  )}
                  {ownerColor && (
                    <div className="owner-marker" style={{ backgroundColor: ownerColor }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Token overlay */}
      <div className="token-overlay">
        {state.players
          .filter((p) => !p.isBankrupt && tokenPositions[p.id])
          .map((p) => {
            const pos = tokenPositions[p.id]!;
            return (
              <div
                key={p.id}
                className={`token-piece ${pos.animate ? 'token-moving' : ''}`}
                style={{
                  left: `${pos.leftPct}%`,
                  top: `${pos.topPct}%`,
                  backgroundColor: p.color,
                  boxShadow: `0 2px 8px ${p.color}aa, 0 0 12px ${p.color}66`,
                  transition: pos.animate
                    ? `left ${TOKEN_MOVE_DURATION}ms ease-in-out, top ${TOKEN_MOVE_DURATION}ms ease-in-out`
                    : 'none',
                }}
                title={p.name}
              >
                <span className="token-initials">{getInitials(p.name)}</span>
              </div>
            );
          })}
      </div>

      {/* Money popups overlay */}
      {moneyPopups.length > 0 && (
        <div className="money-overlay">
          {moneyPopups.map((popup) => {
            const player = playerMap.get(popup.playerId);
            if (!player) return null;
            const pos = tokenPositions[popup.playerId];
            if (!pos) return null;
            return (
              <div
                key={popup.id}
                className={`money-popup ${popup.amount >= 0 ? 'money-gain' : 'money-loss'}`}
                style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
              >
                {popup.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Bubble overlay */}
      {overlayBubbles.length > 0 && (
        <div className="bubble-overlay">
          {overlayBubbles.map(({ bubble, leftPct, topPct }) => (
            <div
              key={bubble.playerId}
              className="speech-bubble"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              <div className="speech-bubble-name">{bubble.playerName}</div>
              <div className="speech-bubble-text">
                {bubble.text.length > 40 ? bubble.text.slice(0, 37) + '...' : bubble.text}
              </div>
              <div className="speech-bubble-tail" />
            </div>
          ))}
        </div>
      )}

      {/* Dice roll animation overlay */}
      {diceRoll && (
        <div className="dice-overlay">
          <div className="dice-roll-wrapper">
            {roller && (
              <div className="dice-roller-badge" style={{
                backgroundColor: roller.color,
                boxShadow: `0 0 16px ${roller.color}88`,
              }}>
                <span className="dice-roller-name">{roller.name}</span>
              </div>
            )}
            <div className="dice-roll-container">
              <div className="dice-roll-die die-1">
                <DiceFace value={diceRoll.dice[0]} isDoubles={diceRoll.doubles} />
              </div>
              <div className="dice-roll-die die-2">
                <DiceFace value={diceRoll.dice[1]} isDoubles={diceRoll.doubles} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
