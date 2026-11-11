export const ROWS = 6;
export const COLS = 7;

export type Player = 0 | 1;
export type Cell = 0 | 1 | 2;
export type Board = Cell[][];

export type EvaluateBoardResponse = {
    status: "in_progress" | "won" | "tied";
    winner: Player | null;
    next_player: Player | null;
}


// Sorry about the AI auto-complete, in the recording you can see vim crashed and cursor is the only editor I have installed on my machine.
export function createBoard(): Board {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// Validate the row is not full return row index if valid, otherwise return -1
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
    
    const next = board.map((r) => [...r]);

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
        throw new Error(`Server rejected the board (${response.status})`);
    }
    return response.json() as Promise<EvaluateBoardResponse>;
}