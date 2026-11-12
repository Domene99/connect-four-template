import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the title and gives the first move to blue", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Connect Four" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Blue to play");
});

test("drops a blue piece in the lowest slot and hands the turn to red", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: "in_progress",
      winner: null,
      next_player: 2,
      winning_cells: [],
      detail: null,
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Drop in column 1" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Red to play");
  expect(screen.getByTestId("cell-5-0")).toHaveAttribute("data-player", "1");
  expect(screen.getByTestId("cell-4-0")).toHaveAttribute("data-player", "0");
  expect(fetchMock).toHaveBeenCalledWith(
    "/evaluate_board_state",
    expect.objectContaining({ method: "POST" }),
  );
});

test("highlights the winning chips and stops play", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    }),
  );

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Drop in column 1" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Blue wins");
  expect(screen.getByTestId("cell-5-0")).toHaveClass("winning");
  expect(screen.getByRole("button", { name: "Drop in column 2" })).toBeDisabled();
});

test("shows a rejection and leaves the board unchanged", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: "Board must have 6 rows and 7 columns" }),
    }),
  );

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Drop in column 4" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Board must have 6 rows and 7 columns",
  );
  expect(screen.getByTestId("cell-5-3")).toHaveAttribute("data-player", "0");
  expect(screen.getByRole("status")).toHaveTextContent("Blue to play");
});
