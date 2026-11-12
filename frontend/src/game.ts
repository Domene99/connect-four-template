export const ROWS = 6;
export const COLS = 7;

export type Player = 1 | 2;
export type Cell = 0 | 1 | 2;
export type Board = Cell[][];

export type EvaluateBoardResponse = {
  status: "in_progress" | "won" | "tied" | "impossible";
  winner: Player | null;
  next_player: Player | null;
  winning_cells: [number, number][];
  detail: string | null;
};

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// Lowest open row in this column, or -1 when the column is full.
export function landingRow(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) {
      return row;
    }
  }
  return -1;
}

export function dropPiece(board: Board, col: number, player: Player): Board | null {
  const row = landingRow(board, col);
  if (row === -1) return null;

  const next = board.map((line) => [...line]);
  next[row][col] = player;
  return next;
}

export async function evaluateBoard(board: Board): Promise<EvaluateBoardResponse> {
  const response = await fetch("/evaluate_board_state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ board }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<EvaluateBoardResponse>;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // The body was empty or not JSON.
  }
  return `Server rejected the board (${response.status})`;
}
