import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import type { Board } from "./game";
import type { GameState, ServerMessage } from "./room";

// Stands in for the browser's WebSocket so tests can play the server's part.
class FakeSocket {
  static instances: FakeSocket[] = [];
  static get last(): FakeSocket {
    return FakeSocket.instances[FakeSocket.instances.length - 1];
  }

  sent: unknown[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {}

  receive(message: ServerMessage) {
    act(() => {
      this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(message) }));
    });
  }

  drop() {
    act(() => {
      this.onclose?.(new CloseEvent("close"));
    });
  }
}

const EMPTY: Board = Array.from({ length: 6 }, () => Array(7).fill(0));

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    type: "state",
    you: 1,
    board: EMPTY,
    opponent_connected: true,
    evaluation: {
      status: "in_progress",
      winner: null,
      next_player: 1,
      winning_cells: [],
      detail: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("joins the room named in the address bar with a token kept for this tab", () => {
  window.history.replaceState(null, "", "/?room=abc123");
  render(<App />);

  expect(screen.getByRole("status")).toHaveTextContent("Connecting…");
  const url = new URL(FakeSocket.last.url);
  expect(url.protocol).toBe("ws:");
  expect(url.pathname).toBe("/ws/abc123");
  expect(url.searchParams.get("token")).toBe(sessionStorage.getItem("connect-four-token"));
  expect(screen.getByRole("button", { name: "Drop in column 1" })).toBeDisabled();
});

test("starts a room when there is none and shows an invite link while alone", () => {
  render(<App />);
  const room = new URL(window.location.href).searchParams.get("room");
  expect(room).toMatch(/^[0-9a-f]{8}$/);
  expect(FakeSocket.last.url).toContain(`/ws/${room}?`);

  FakeSocket.last.receive(state({ opponent_connected: false }));

  expect(screen.getByRole("status")).toHaveTextContent("Waiting for an opponent to join");
  expect(screen.getByText(/You are/)).toHaveTextContent("Blue");
  expect(screen.getByLabelText("Share this link with your opponent")).toHaveValue(
    window.location.href,
  );
  expect(screen.getByRole("button", { name: "Drop in column 1" })).toBeDisabled();
});

test("sends a move on your turn and shows the board the server returns", () => {
  render(<App />);
  const socket = FakeSocket.last;
  socket.receive(state());
  expect(screen.getByRole("status")).toHaveTextContent("Your turn");
  expect(screen.queryByLabelText("Share this link with your opponent")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Drop in column 1" }));
  expect(socket.sent).toEqual([{ type: "move", col: 0 }]);
  // Nothing changes until the server says so.
  expect(screen.getByTestId("cell-5-0")).toHaveAttribute("data-player", "0");

  const board = EMPTY.map((row) => [...row]) as Board;
  board[5][0] = 1;
  socket.receive(
    state({ board, evaluation: { ...state().evaluation, next_player: 2 } }),
  );

  expect(screen.getByTestId("cell-5-0")).toHaveAttribute("data-player", "1");
  expect(screen.getByRole("status")).toHaveTextContent("Red's turn");
  expect(screen.getByRole("button", { name: "Drop in column 2" })).toBeDisabled();
});

test("shows a rejection from the server until the next state arrives", () => {
  render(<App />);
  const socket = FakeSocket.last;
  socket.receive(state());
  socket.receive({ type: "error", detail: "It is not your turn" });

  expect(screen.getByRole("alert")).toHaveTextContent("It is not your turn");

  socket.receive(state());
  expect(screen.queryByRole("alert")).toBeNull();
});

test("highlights the winning chips and lets either player start a new game", () => {
  render(<App />);
  const socket = FakeSocket.last;
  socket.receive(
    state({
      you: 2,
      evaluation: {
        status: "won",
        winner: 1,
        next_player: null,
        winning_cells: [
          [5, 0],
          [5, 1],
          [5, 2],
          [5, 3],
        ],
        detail: null,
      },
    }),
  );

  expect(screen.getByRole("status")).toHaveTextContent("Blue wins");
  expect(screen.getByTestId("cell-5-0")).toHaveClass("winning");
  expect(screen.getByRole("button", { name: "Drop in column 5" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "New game" }));
  expect(socket.sent).toEqual([{ type: "reset" }]);
});

test("tells the winner they won", () => {
  render(<App />);
  FakeSocket.last.receive(
    state({
      evaluation: {
        status: "won",
        winner: 1,
        next_player: null,
        winning_cells: [],
        detail: null,
      },
    }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("You win");
});

test("reports a lost connection and stops play", () => {
  render(<App />);
  const socket = FakeSocket.last;
  socket.receive(state());
  socket.drop();

  expect(screen.getByRole("status")).toHaveTextContent("Connection lost");
  expect(screen.getByRole("button", { name: "Drop in column 1" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "New game" })).toBeDisabled();
});

test("a third player is told the game is full", () => {
  render(<App />);
  const socket = FakeSocket.last;
  socket.receive({ type: "error", detail: "This game already has two players" });
  socket.drop();

  expect(screen.getByRole("status")).toHaveTextContent("This game already has two players");
  expect(screen.queryByRole("alert")).toBeNull();
});
