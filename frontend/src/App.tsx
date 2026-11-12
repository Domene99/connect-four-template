import { useState } from "react";
import { ROWS, COLS,
  createBoard, dropPiece, evaluateBoard, Board, Player, EvaluateBoardResponse } from "./game";
import BoardComponent from "./Board"

const START: EvaluateBoardResponse = {
  status: "in_progress",
  next_player: 1,
  winner: null,
}


export default function App() {
  const [board, setBoard] = useState<Board>(createBoard());
  const [result, setResult] = useState<EvaluateBoardResponse>(START);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = result.next_player;

  async function play(col: number) {
    if (pending || player === null) return;
    const next = dropPiece(board, col, player);
    if (next === null) return;
    setPending(true);
    setError(null);
    try {
      const result = await evaluateBoard(next);
      setBoard(next);
      setResult(result);
    } catch (error) {
      setError(`Server rejected the board (${error})`);
    } finally {
      setPending(false);
    }
  }

  // Again, sorry about the AI auto-complete. I'm reviewing every line and just clicking enter if that's what I was going to do anyway.

  function reset() {
    setBoard(createBoard());
    setResult(START);
    setError(null);
    setPending(false);
  }

  let status: string;
  if (result.status === "won") {
    status = `Player ${result.winner} wins!`;
  } else if (result.status === "tied") {
    status = "Tied game!";
  } else {
    status = `Player ${result.next_player} to play`;
  }
  
  
  return (
    <main>
      <h1>Connect Four</h1>
      
      <BoardComponent
        board = {board}
        disabled = {pending || player === null}
        onDrop = {play}/>

    </main>
  );
}
