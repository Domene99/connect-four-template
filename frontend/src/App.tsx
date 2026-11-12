import { useState } from "react";
import {
  createBoard,
  dropPiece,
  evaluateBoard,
  type Board,
  type EvaluateBoardResponse,
  type Player,
} from "./game";
import BoardComponent from "./Board";

const START: EvaluateBoardResponse = {
  status: "in_progress",
  next_player: 1,
  winner: null,
  winning_cells: [],
  detail: null,
};

export default function App() {
  const [board, setBoard] = useState<Board>(createBoard());
  const [result, setResult] = useState<EvaluateBoardResponse>(START);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = result.next_player;
  const winning = new Set(
    (result.winning_cells ?? []).map(([row, col]) => `${row}-${col}`),
  );

  async function play(col: number) {
    if (pending || player === null) return;
    const next = dropPiece(board, col, player);
    if (next === null) return;
    setPending(true);
    setError(null);
    try {
      const evaluation = await evaluateBoard(next);
      setBoard(next);
      setResult(evaluation);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Server rejected the board";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setBoard(createBoard());
    setResult(START);
    setError(null);
    setPending(false);
  }

  let status: string;
  if (pending) {
    status = "Checking the board…";
  } else if (result.status === "won") {
    status = `${playerName(result.winner)} wins`;
  } else if (result.status === "tied") {
    status = "Draw";
  } else if (result.status === "impossible") {
    status = result.detail ?? "This position is impossible";
  } else {
    status = `${playerName(result.next_player)} to play`;
  }

  return (
    <main>
      <h1>Connect Four</h1>
      <p className="status" role="status">
        {status}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <BoardComponent
        board={board}
        disabled={pending || player === null}
        winning={winning}
        onDrop={play}
      />
      <button type="button" className="reset" onClick={reset}>
        New game
      </button>
    </main>
  );
}

function playerName(player: Player | null): string {
  if (player === 1) return "Blue";
  if (player === 2) return "Red";
  return "Nobody";
}
