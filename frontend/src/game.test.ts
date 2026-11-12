import { expect, test } from "vitest";
import { createBoard, dropPiece } from "./game";

test("a piece lands in the lowest open slot and a full column is rejected", () => {
  let board = createBoard();
  board = dropPiece(board, 0, 1)!;
  board = dropPiece(board, 0, 2)!;

  expect(board[5][0]).toBe(1);
  expect(board[4][0]).toBe(2);
  expect(board[3][0]).toBe(0);

  for (let placed = 0; placed < 4; placed++) {
    board = dropPiece(board, 0, placed % 2 === 0 ? 1 : 2)!;
  }
  expect(dropPiece(board, 0, 1)).toBeNull();
});
