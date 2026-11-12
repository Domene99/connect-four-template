from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Literal

from game import Evaluation, evaluate

app = FastAPI(title="Connect Four")

Cell = Literal[0, 1, 2]


class State(BaseModel):
    board: list[list[Cell]]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/evaluate_board_state")
def evaluate_board_state(state: State) -> Evaluation:
    try:
        return evaluate(state.board)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
