import asyncio
import contextlib
import json
from dataclasses import asdict, dataclass, field
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Path, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from game import Evaluation, Match, evaluate

app = FastAPI(title="Connect Four")

Cell = Literal[0, 1, 2]
Seat = Literal[1, 2]
SEATS: tuple[Seat, ...] = (1, 2)

# Close code sent to a third player; browsers surface it on the close event.
ROOM_FULL = 4000


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


@dataclass
class Room:
    """A match plus the two seats around it, each held by one browser tab.

    A seat is keyed by the tab's token, so a tab that reconnects (a refresh,
    or React StrictMode opening the socket twice in development) takes over
    its own seat instead of being treated as a second player.
    """

    match: Match = field(default_factory=Match)
    tokens: dict[Seat, str] = field(default_factory=dict)
    sockets: dict[Seat, WebSocket] = field(default_factory=dict)

    def seat_for(self, token: str) -> Seat | None:
        for seat in SEATS:
            if self.tokens.get(seat) == token:
                return seat
        for seat in SEATS:
            if seat not in self.tokens:
                return seat
        return None

    def state_for(self, seat: Seat) -> dict:
        return {
            "type": "state",
            "you": seat,
            "board": self.match.board,
            "evaluation": asdict(self.match.evaluation),
            "opponent_connected": any(other != seat for other in self.sockets),
        }

    async def broadcast(self) -> None:
        # A socket that has just gone away is cleaned up by its own handler.
        await asyncio.gather(
            *(socket.send_json(self.state_for(seat)) for seat, socket in self.sockets.items()),
            return_exceptions=True,
        )


rooms: dict[str, Room] = {}


def handle(room: Room, seat: Seat, message: object) -> None:
    match message:
        case {"type": "move", "col": int(col)}:
            room.match.move(seat, col)
        case {"type": "reset"}:
            room.match.reset()
        case _:
            raise ValueError("Unknown message")


@app.websocket("/ws/{room_id}")
async def play(
    websocket: WebSocket,
    room_id: Annotated[str, Path(max_length=32, pattern=r"^[\w-]+$")],
    token: Annotated[str, Query(min_length=1, max_length=64)],
) -> None:
    await websocket.accept()
    room = rooms.setdefault(room_id, Room())
    seat = room.seat_for(token)
    if seat is None:
        await websocket.send_json({"type": "error", "detail": "This game already has two players"})
        await websocket.close(code=ROOM_FULL)
        return

    replaced = room.sockets.get(seat)
    room.tokens[seat] = token
    room.sockets[seat] = websocket
    if replaced is not None:
        with contextlib.suppress(RuntimeError, OSError):
            await replaced.close()
    await room.broadcast()

    try:
        while True:
            text = await websocket.receive_text()
            try:
                handle(room, seat, json.loads(text))
            except ValueError as exc:  # includes JSONDecodeError
                await websocket.send_json({"type": "error", "detail": str(exc)})
                continue
            await room.broadcast()
    except WebSocketDisconnect:
        pass
    finally:
        if room.sockets.get(seat) is websocket:
            del room.sockets[seat]
            del room.tokens[seat]
            if room.sockets:
                await room.broadcast()
            else:
                rooms.pop(room_id, None)
