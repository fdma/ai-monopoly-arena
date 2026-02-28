import { useEffect, useRef, useState } from 'react';
import { BOARD, COLOR_MAP } from '../board-data';
import type { GameState, PropertyState, ColorGroup } from '../types';

interface Props {
  state: GameState;
}

interface BalancePoint {
  turn: number;
  balances: Record<string, number>;
}

const GROUP_ORDER: ColorGroup[] = [
  'brown', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkBlue',
];

function phaseLabel(state: GameState): string {
  const phase = state.phase;
  const cp = state.players[state.currentPlayerIndex];
  switch (phase.type) {
    case 'pre_game': return 'Waiting to start...';
    case 'awaiting_roll': return `${cp?.name}: Roll dice`;
    case 'awaiting_buy_decision': {
      const cell = BOARD[phase.cellIndex];
      return `${cp?.name}: Buy ${cell?.name} ($${phase.price})?`;
    }
    case 'awaiting_auction_bids': {
      const cell = BOARD[phase.cellIndex];
      return `Auction: ${cell?.name}`;
    }
    case 'awaiting_jail_decision': return `${cp?.name}: In Jail`;
    case 'turn_end': return `${cp?.name}: End turn`;
    case 'game_over':
      return `Winner: ${state.players.find((p) => p.id === phase.winnerId)?.name}`;
  }
}

function hasMonopoly(playerId: string, group: ColorGroup, properties: PropertyState[]): boolean {
  const cells = BOARD.filter((c) => c.colorGroup === group);
  return cells.every((c) => properties.find((p) => p.cellIndex === c.index)?.ownerId === playerId);
}

function netWorth(playerId: string, money: number, properties: PropertyState[]): number {
  let val = money;
  for (const prop of properties) {
    if (prop.ownerId !== playerId) continue;
    const cell = BOARD[prop.cellIndex];
    if (cell?.price) val += cell.price;
    if (cell?.houseCost) val += prop.houses * cell.houseCost;
  }
  return val;
}

// Build smooth SVG path from points using Catmull-Rom to cubic bezier
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0]!.x},${pts[0]!.y}L${pts[1]!.x},${pts[1]!.y}`;

  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
  }
  return d;
}

// Lightweight SVG line chart with smooth animation
function BalanceChart({ history, players }: { history: BalancePoint[]; players: GameState['players'] }) {
  if (history.length < 2) return null;

  const W = 320;
  const H = 130;
  const PAD_L = 36;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 20;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  let maxVal = 1500;
  let minVal = 0;
  for (const pt of history) {
    for (const v of Object.values(pt.balances)) {
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }
  }
  maxVal = Math.ceil(maxVal / 500) * 500;

  const xScale = (i: number) => PAD_L + (i / Math.max(1, history.length - 1)) * chartW;
  const yScale = (v: number) => PAD_T + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  const gridLines: number[] = [];
  const step = maxVal <= 2000 ? 500 : maxVal <= 5000 ? 1000 : 2000;
  for (let v = 0; v <= maxVal; v += step) gridLines.push(v);

  return (
    <div className="balance-chart">
      <div className="chart-title">Balance</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {gridLines.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={yScale(v)} x2={W - PAD_R} y2={yScale(v)}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD_L - 4} y={yScale(v) + 3} textAnchor="end"
              fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="Inter, sans-serif">
              ${v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
            </text>
          </g>
        ))}

        {history.length > 1 && [0, Math.floor(history.length / 2), history.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle"
              fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily="Inter, sans-serif">
              T{history[i]!.turn}
            </text>
          ))}

        {/* Smooth animated lines per player */}
        {players.map((player) => {
          const pts: { x: number; y: number }[] = [];
          for (let i = 0; i < history.length; i++) {
            const val = history[i]!.balances[player.id];
            if (val !== undefined) pts.push({ x: xScale(i), y: yScale(val) });
          }
          if (pts.length < 2) return null;
          const d = smoothPath(pts);
          const lastPt = pts[pts.length - 1]!;
          return (
            <g key={player.id} opacity={player.isBankrupt ? 0.3 : 1}>
              {/* Glow behind line */}
              <path d={d} fill="none" stroke={player.color} strokeWidth={5}
                strokeLinecap="round" strokeLinejoin="round" opacity={0.15}
                className="chart-line" />
              {/* Main line */}
              <path d={d} fill="none" stroke={player.color} strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" opacity={0.9}
                className="chart-line" />
              {/* End dot */}
              <circle cx={lastPt.x} cy={lastPt.y} r={3}
                fill={player.color} stroke="rgba(255,255,255,0.5)" strokeWidth={1}
                className="chart-dot" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Dashboard({ state }: Props) {
  const isDoubles = state.lastDice ? state.lastDice[0] === state.lastDice[1] : false;
  const [history, setHistory] = useState<BalancePoint[]>([]);
  const lastTurnRef = useRef<number>(-1);
  const gameIdRef = useRef<string>('');

  // Reset history on new game, track balance at each turn change
  useEffect(() => {
    if (state.gameId !== gameIdRef.current) {
      gameIdRef.current = state.gameId;
      lastTurnRef.current = -1;
      setHistory([]);
    }
    if (state.turn !== lastTurnRef.current) {
      lastTurnRef.current = state.turn;
      const balances: Record<string, number> = {};
      for (const p of state.players) {
        balances[p.id] = p.money;
      }
      setHistory((prev) => [...prev, { turn: state.turn, balances }]);
    }
  }, [state.gameId, state.turn, state.players]);

  return (
    <div className="dash glass-card">
      {/* Phase banner */}
      <div className="dash-phase">
        <span className="dash-turn">#{state.turn}</span>
        <span className="dash-phase-text">{phaseLabel(state)}</span>
        {state.lastDice && (
          <div className="dice-display">
            <span className={`die ${isDoubles ? 'doubles' : ''}`}>{state.lastDice[0]}</span>
            <span className={`die ${isDoubles ? 'doubles' : ''}`}>{state.lastDice[1]}</span>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="dash-players">
        {state.players.map((player, idx) => {
          const isCurrent = idx === state.currentPlayerIndex;
          const owned = state.properties.filter((p) => p.ownerId === player.id);
          const nw = netWorth(player.id, player.money, state.properties);
          const totalHouses = owned.reduce((s, p) => s + p.houses, 0);

          // Owned color properties grouped
          const colorGroups: { group: ColorGroup; props: PropertyState[]; mono: boolean }[] = [];
          for (const g of GROUP_ORDER) {
            const gProps = owned.filter((p) => BOARD[p.cellIndex]?.colorGroup === g);
            if (gProps.length === 0) continue;
            colorGroups.push({ group: g, props: gProps, mono: hasMonopoly(player.id, g, state.properties) });
          }

          const ownedRR = owned.filter((p) => BOARD[p.cellIndex]?.type === 'railroad');
          const ownedUtil = owned.filter((p) => BOARD[p.cellIndex]?.type === 'utility');

          return (
            <div
              key={player.id}
              className={`dash-player ${isCurrent ? 'active' : ''} ${player.isBankrupt ? 'bankrupt' : ''}`}
            >
              {/* Row 1: identity + money */}
              <div className="dash-player-top">
                <span className="dash-dot" style={{ backgroundColor: player.color, boxShadow: `0 0 6px ${player.color}` }} />
                <span className="dash-name">{player.name}</span>
                {player.isInJail && <span className="dash-badge jail">Jail</span>}
                {player.isBankrupt && <span className="dash-badge out">Out</span>}
                <span className="dash-money">${player.money}</span>
                <span className="dash-net" title="Net worth">({nw})</span>
              </div>

              {/* Row 2: property chips */}
              <div className="dash-chips">
                {colorGroups.map(({ group, props, mono }) => (
                  <div key={group} className={`dash-chip-group ${mono ? 'mono' : ''}`}>
                    {props.map((p) => {
                      const cell = BOARD[p.cellIndex]!;
                      return (
                        <div
                          key={p.cellIndex}
                          className="dash-chip"
                          style={{ backgroundColor: COLOR_MAP[group] }}
                          title={`${cell.name} ($${cell.price})${p.houses > 0 ? ` [${p.houses === 5 ? 'Hotel' : p.houses + 'H'}]` : ''}`}
                        >
                          {p.houses > 0 && p.houses < 5 && (
                            <span className="dash-chip-h">{p.houses}</span>
                          )}
                          {p.houses === 5 && (
                            <span className="dash-chip-hotel">H</span>
                          )}
                        </div>
                      );
                    })}
                    {mono && <span className="dash-mono-dot" />}
                  </div>
                ))}

                {ownedRR.length > 0 && (
                  <div className="dash-chip-group">
                    {ownedRR.map((p) => (
                      <div
                        key={p.cellIndex}
                        className="dash-chip dash-chip-rr"
                        title={BOARD[p.cellIndex]?.name}
                      >
                        RR
                      </div>
                    ))}
                  </div>
                )}

                {ownedUtil.length > 0 && (
                  <div className="dash-chip-group">
                    {ownedUtil.map((p) => (
                      <div
                        key={p.cellIndex}
                        className="dash-chip dash-chip-util"
                        title={BOARD[p.cellIndex]?.name}
                      >
                        U
                      </div>
                    ))}
                  </div>
                )}

                {owned.length === 0 && (
                  <span className="dash-no-props">---</span>
                )}

                {totalHouses > 0 && (
                  <span className="dash-house-count" title="Total houses/hotels">
                    {totalHouses}h
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Balance chart */}
      <BalanceChart history={history} players={state.players} />
    </div>
  );
}
