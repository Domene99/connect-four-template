import { useEffect, useRef, useState } from "react";
import { createBoard, playerName } from "./game";
import {
  roomFromUrl,
  socketUrl,
  tabToken,
  type ClientMessage,
  type GameState,
  type ServerMessage,
} from "./room";
import BoardComponent from "./Board";

const EMPTY_BOARD = createBoard();

export default function App() {
  const [room] = useState(roomFromUrl);
  const socket = useRef<WebSocket | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(socketUrl(room, tabToken()));
    socket.current = ws;
    ws.onmessage = (event: MessageEvent<string>) => {
      const message: ServerMessage = JSON.parse(event.data);
      if (message.type === "state") {
        setGame(message);
        setError(null);
      } else {
        setError(message.detail);
      }
    };
    ws.onclose = () => setClosed(true);
    return () => {
      // Detach first: closing our own socket is not a lost connection.
      ws.onmessage = null;
      ws.onclose = null;
      ws.close();
    };
  }, [room]);

  function send(message: ClientMessage) {
    socket.current?.send(JSON.stringify(message));
  }

  const evaluation = game?.evaluation ?? null;
  const myTurn = game !== null && evaluation?.next_player === game.you;
  const waiting = game !== null && !game.opponent_connected;
  const winning = new Set(
    (evaluation?.winning_cells ?? []).map(([row, col]) => `${row}-${col}`),
  );

  let status: string;
  if (closed) {
    status = error ?? "Connection lost. Reload the page to rejoin.";
  } else if (game === null || evaluation === null) {
    status = "Connecting…";
  } else if (evaluation.status === "won") {
    status = evaluation.winner === game.you ? "You win" : `${playerName(evaluation.winner)} wins`;
  } else if (evaluation.status === "tied") {
    status = "Draw";
  } else if (evaluation.status === "impossible") {
    status = evaluation.detail ?? "This position is impossible";
  } else if (waiting) {
    status = "Waiting for an opponent to join";
  } else {
    status = myTurn ? "Your turn" : `${playerName(evaluation.next_player)}'s turn`;
  }

  return (
    <main>
      <h1>Connect Four</h1>
      {game ? (
        <p className="you">
          You are <span className="chip" data-player={game.you} /> {playerName(game.you)}
        </p>
      ) : null}
      <p className="status" role="status">
        {status}
      </p>
      {error && !closed ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {waiting && !closed ? (
        <label className="invite">
          Share this link with your opponent
          <input
            readOnly
            value={window.location.href}
            onFocus={(event) => event.target.select()}
          />
        </label>
      ) : null}
      <BoardComponent
        board={game?.board ?? EMPTY_BOARD}
        disabled={closed || !myTurn || waiting}
        winning={winning}
        onDrop={(col) => send({ type: "move", col })}
      />
      <button
        type="button"
        className="reset"
        disabled={closed || game === null}
        onClick={() => send({ type: "reset" })}
      >
        New game
      </button>
    </main>
  );
}
