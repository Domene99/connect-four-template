"""Connect Four rules, independent of the HTTP layer.

Board coordinates match the API: 6 rows by 7 columns, row 0 at the top,
and pieces stacked toward row 5. Cells are 0 (empty), 1 (blue), or 2 (red).
Blue always moves first.
"""

from dataclasses import dataclass, field

ROWS = 6
COLS = 7
CONNECT = 4

# Right, down, down-right, down-left. Scanning every cell covers the opposite way.
DIRECTIONS = ((0, 1), (1, 0), (1, 1), (1, -1))


@dataclass(frozen=True)
class Evaluation:
    status: str
    winner: int | None = None
    next_player: int | None = None
    winning_cells: list[list[int]] = field(default_factory=list)
    detail: str | None = None


def evaluate(board: list[list[int]]) -> Evaluation:
    _validate_shape(board)

    blue, red = _counts(board)
    if red > blue or blue > red + 1:
        return _impossible("Piece counts are impossible if blue moves first")
    if _has_floating_piece(board):
        return _impossible("A piece is floating above an empty slot")

    wins = {player: _winning_cells(board, player) for player in (1, 2)}
    winners = [player for player, cells in wins.items() if cells]
    if len(winners) > 1:
        return _impossible("Both players have a connect four")

    if winners:
        winner = winners[0]
        moved_last = 1 if blue == red + 1 else 2
        if winner != moved_last:
            return _impossible("The winner was not the last player to move")
        if not _last_move_could_complete(board, winner, wins[winner]):
            return _impossible("The board was already won before the last move")
        return Evaluation(
            status="won",
            winner=winner,
            winning_cells=[[row, col] for row, col in sorted(wins[winner])],
        )

    if blue + red == ROWS * COLS:
        return Evaluation(status="tied")

    return Evaluation(status="in_progress", next_player=1 if blue == red else 2)


def drop(board: list[list[int]], col: int, player: int) -> list[list[int]]:
    """Return a copy of the board with ``player``'s piece in the lowest open slot."""
    if not 0 <= col < COLS:
        raise ValueError("Column must be between 0 and 6")
    for row in range(ROWS - 1, -1, -1):
        if board[row][col] == 0:
            result = [list(line) for line in board]
            result[row][col] = player
            return result
    raise ValueError("That column is full")


def _validate_shape(board: list[list[int]]) -> None:
    if len(board) != ROWS or any(len(row) != COLS for row in board):
        raise ValueError("Board must have 6 rows and 7 columns")
    if any(cell not in (0, 1, 2) for row in board for cell in row):
        raise ValueError("Each cell must be 0, 1, or 2")


def _counts(board: list[list[int]]) -> tuple[int, int]:
    blue = sum(cell == 1 for row in board for cell in row)
    red = sum(cell == 2 for row in board for cell in row)
    return blue, red


def _has_floating_piece(board: list[list[int]]) -> bool:
    for col in range(COLS):
        seen_empty = False
        for row in range(ROWS - 1, -1, -1):
            if board[row][col] == 0:
                seen_empty = True
            elif seen_empty:
                return True
    return False


def _winning_cells(board: list[list[int]], player: int) -> set[tuple[int, int]]:
    found: set[tuple[int, int]] = set()
    for row in range(ROWS):
        for col in range(COLS):
            if board[row][col] != player:
                continue
            for d_row, d_col in DIRECTIONS:
                line: list[tuple[int, int]] = []
                for step in range(CONNECT):
                    next_row = row + step * d_row
                    next_col = col + step * d_col
                    if not (0 <= next_row < ROWS and 0 <= next_col < COLS):
                        break
                    if board[next_row][next_col] != player:
                        break
                    line.append((next_row, next_col))
                if len(line) == CONNECT:
                    found.update(line)
    return found


def _last_move_could_complete(
    board: list[list[int]], player: int, cells: set[tuple[int, int]]
) -> bool:
    """True when one of this player's winning pieces can be the move that won.

    One move can complete more than one line, so those lines share a cell.
    Two separate connect fours do not: removing any single piece leaves a win,
    which means the game continued after it was already over.
    """
    for row, col in cells:
        trial = [list(line) for line in board]
        trial[row][col] = 0
        if not _winning_cells(trial, player):
            return True
    return False


def _impossible(detail: str) -> Evaluation:
    return Evaluation(status="impossible", detail=detail)


class Match:
    """One game between two players, advanced one move at a time.

    The board is re-evaluated after every move, so ``evaluation`` always
    describes the current position and whose turn it is.
    """

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.board = [[0] * COLS for _ in range(ROWS)]
        self.evaluation = evaluate(self.board)

    def move(self, player: int, col: int) -> None:
        if self.evaluation.status != "in_progress":
            raise ValueError("The game is over")
        if self.evaluation.next_player != player:
            raise ValueError("It is not your turn")
        board = drop(self.board, col, player)
        self.board = board
        self.evaluation = evaluate(board)
