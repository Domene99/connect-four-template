export const ROWS = 6;
export const COLS = 7;

export type Player = 1 | 2;
export type Cell = 0 | 1 | 2;
export type Board = Cell[][];

// The backend's verdict on a position, as returned by /evaluate_board_state
// and included in every WebSocket state message.
export type Evaluation = {
  status: "in_progress" | "won" | "tied" | "impossible";
  winner: Player | null;
  next_player: Player | null;
  winning_cells: [number, number][];
  detail: string | null;
};

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

export function playerName(player: Player | null): string {
  if (player === 1) return "Blue";
  if (player === 2) return "Red";
  return "Nobody";
}
