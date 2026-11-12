from fastapi import FastAPI
from pydantic import BaseModel
from typing import Literal, Optional 

app = FastAPI(title="Connect Four")

Cell = Literal[0, 1, 2]

Player = Literal[0, 1]

COLS = 7
ROWS = 6
CONNECT = 4

class State(BaseModel):
    board: list[list[Cell]]

class EvaluateBoardResponse(BaseModel):
    status: Literal["in_progress", "won", "tied"]
    winner: Optional[Player]
    next_player: Optional[Player]

def validate(board):
    if len(board) != ROWS or any(len(row) != COLS for row in board):
        raise HTTPException(422, "Board does not comply")

def find_wins(board):
    # No need to check wins in mirror directions
    directions = ((0, 1), (1, 0), (1, 1), (1, -1))

    for row in range(ROWS):
        for col in range(COLS):

            player = board[col][row]

            if player == 0:
                continue

            for d_row, d_col in directions:
                # We create a set of the line such that row, col is the starting point and we move to a direction 4 times and check those 4
                line = [(row + i * d_row, col + i * d_col) for i in range(CONNECT)]

                if all( 0 <= r and r < ROWS and 0 <= c and c < COLS and board[r][c] == player for r, c in line):
                    return player

    return 0

def tied(board):
    return all(cell != 0 for row in board for cell in row)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/evaluate_board_state")
def evaluate_board_state(state: State):
    board = state.board

    winner = find_wins(board)

    if winner != 0:
        return EvaluateBoardResponse(status="won", winner=winner)

    if tied(board):
        return EvaluateBoardResponse(status="tied")

    return EvaluateBoardResponse(status="in_progress")
