import { BOARD, COLOR_MAP } from '../board-data';
import type { GameState, Player, PropertyState } from '../types';
import './Board.css';

interface Props {
  state: GameState;
}

// Board layout: 11x11 grid, cells around the perimeter
// Bottom row: 10..0 (left to right becomes 10,9,8,...,0)
// Left column: 11..19 (bottom to top becomes 11,12,...,19)  — wait
// Actually classic monopoly board:
// Bottom row (right to left): 0,1,2,...,10
// Left column (bottom to top): 11,12,...,19
// Top row (left to right): 20,21,...,30
// Right column (top to bottom): 31,32,...,39

function getCellPosition(index: number): { row: number; col: number } {
  if (index <= 10) {
    // Bottom row: index 0 is bottom-right corner, 10 is bottom-left
    return { row: 10, col: 10 - index };
  } else if (index <= 19) {
    // Left column: 11 is just above bottom-left
    return { row: 10 - (index - 10), col: 0 };
  } else if (index <= 30) {
    // Top row: 20 is top-left corner, 30 is top-right
    return { row: 0, col: index - 20 };
  } else {
    // Right column: 31 is just below top-right
    return { row: index - 30, col: 10 };
  }
}

function getPropInfo(cellIndex: number, properties: PropertyState[], players: Player[]): { ownerColor: string | null; houses: number } {
  const prop = properties.find((p) => p.cellIndex === cellIndex);
  if (!prop?.ownerId) return { ownerColor: null, houses: 0 };
  const owner = players.find((p) => p.id === prop.ownerId);
  return { ownerColor: owner?.color ?? null, houses: prop.houses };
}

function HouseIndicator({ houses }: { houses: number }) {
  if (houses === 0) return null;
  if (houses === 5) {
    return <div className="houses hotel" title="Hotel">H</div>;
  }
  return (
    <div className="houses" title={`${houses} house${houses > 1 ? 's' : ''}`}>
      {''.repeat(houses)}
    </div>
  );
}

export function Board({ state }: Props) {
  const grid: (number | null)[][] = Array.from({ length: 11 }, () =>
    Array.from({ length: 11 }, () => null),
  );

  for (let i = 0; i < 40; i++) {
    const { row, col } = getCellPosition(i);
    grid[row]![col] = i;
  }

  const playersAtPosition: Record<number, Player[]> = {};
  for (const p of state.players) {
    if (p.isBankrupt) continue;
    if (!playersAtPosition[p.position]) playersAtPosition[p.position] = [];
    playersAtPosition[p.position]!.push(p);
  }

  return (
    <div className="board">
      {grid.map((row, ri) => (
        <div key={ri} className="board-row">
          {row.map((cellIdx, ci) => {
            if (cellIdx === null) {
              if (ri === 0 || ri === 10 || ci === 0 || ci === 10) {
                return <div key={ci} className="board-cell empty" />;
              }
              // Center area
              if (ri === 5 && ci === 5) {
                return (
                  <div key={ci} className="board-center" style={{ gridColumn: 'span 1' }}>
                    MONOPOLY
                  </div>
                );
              }
              return <div key={ci} className="board-inner" />;
            }

            const cell = BOARD[cellIdx]!;
            const isCorner = [0, 10, 20, 30].includes(cellIdx);
            const colorBg = cell.colorGroup ? COLOR_MAP[cell.colorGroup] : undefined;
            const { ownerColor, houses } = getPropInfo(cellIdx, state.properties, state.players);
            const tokens = playersAtPosition[cellIdx] ?? [];

            return (
              <div
                key={ci}
                className={`board-cell ${isCorner ? 'corner' : ''}`}
                title={`${cell.name}${cell.price ? ` ($${cell.price})` : ''}${houses > 0 ? ` [${houses === 5 ? 'Hotel' : houses + 'H'}]` : ''}`}
              >
                {colorBg && <div className="color-strip" style={{ backgroundColor: colorBg }} />}
                <HouseIndicator houses={houses} />
                <div className="cell-name">{cell.name}</div>
                {cell.price && cell.type !== 'tax' && (
                  <div className="cell-price">${cell.price}</div>
                )}
                {ownerColor && (
                  <div className="owner-marker" style={{ backgroundColor: ownerColor }} />
                )}
                {tokens.length > 0 && (
                  <div className="tokens">
                    {tokens.map((p) => (
                      <div
                        key={p.id}
                        className="token"
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
