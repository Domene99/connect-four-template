"""Two remote players sharing one room over WebSockets."""

from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession
from starlette.websockets import WebSocketDisconnect

import main
from main import ROOM_FULL, app

# Entering the client runs every socket on one event loop, as uvicorn does.
# Outside the block each socket gets its own thread, and a handler sending to
# the other player's socket crosses threads and can hang.
client = TestClient(app)


@pytest.fixture(autouse=True)
def shared_loop_and_fresh_rooms() -> Iterator[None]:
    main.rooms.clear()
    with client:
        yield
    main.rooms.clear()


@contextmanager
def join(room: str, token: str) -> Iterator[WebSocketTestSession]:
    with client.websocket_connect(f"/ws/{room}?token={token}") as socket:
        yield socket


@contextmanager
def two_players() -> Iterator[tuple[WebSocketTestSession, WebSocketTestSession]]:
    with join("abc", "blue-tab") as blue, join("abc", "red-tab") as red:
        blue.receive_json()  # alone
        blue.receive_json()  # red arrived
        red.receive_json()
        yield blue, red


def move(player: WebSocketTestSession, col: int) -> None:
    player.send_json({"type": "move", "col": col})


def test_first_player_is_blue_and_waits_for_an_opponent() -> None:
    with join("abc", "blue-tab") as blue:
        state = blue.receive_json()
    assert state["type"] == "state"
    assert state["you"] == 1
    assert state["opponent_connected"] is False
    assert state["evaluation"]["status"] == "in_progress"
    assert state["evaluation"]["next_player"] == 1
    assert state["board"] == [[0] * 7 for _ in range(6)]


def test_second_player_is_red_and_both_see_each_other() -> None:
    with join("abc", "blue-tab") as blue, join("abc", "red-tab") as red:
        blue.receive_json()
        assert blue.receive_json()["opponent_connected"] is True
        state = red.receive_json()
    assert state["you"] == 2
    assert state["opponent_connected"] is True


def test_third_player_is_turned_away() -> None:
    with join("abc", "blue-tab"), join("abc", "red-tab"):
        with pytest.raises(WebSocketDisconnect) as closed:
            with join("abc", "late-tab") as late:
                assert late.receive_json() == {
                    "type": "error",
                    "detail": "This game already has two players",
                }
                late.receive_json()
        assert closed.value.code == ROOM_FULL


def test_a_move_lands_and_is_broadcast_to_both_players() -> None:
    with two_players() as (blue, red):
        move(blue, 3)
        for player in (blue, red):
            state = player.receive_json()
            assert state["board"][5][3] == 1
            assert state["evaluation"]["next_player"] == 2


def test_moving_out_of_turn_is_rejected_privately() -> None:
    with two_players() as (blue, red):
        move(red, 0)
        assert red.receive_json() == {"type": "error", "detail": "It is not your turn"}
        # Blue hears nothing; its next message is the broadcast of its own move.
        move(blue, 0)
        assert blue.receive_json()["board"][5][0] == 1
        assert red.receive_json()["board"][5][0] == 1


def test_full_column_and_bad_messages_are_rejected() -> None:
    with two_players() as (blue, red):
        for turn in range(6):
            move(blue if turn % 2 == 0 else red, 0)
            blue.receive_json()
            red.receive_json()
        move(blue, 0)
        assert blue.receive_json()["detail"] == "That column is full"
        move(blue, 7)
        assert blue.receive_json()["detail"] == "Column must be between 0 and 6"
        blue.send_json({"type": "move"})
        assert blue.receive_json()["detail"] == "Unknown message"
        blue.send_text("not json")
        assert blue.receive_json()["type"] == "error"


def test_win_stops_play_until_someone_starts_a_new_game() -> None:
    with two_players() as (blue, red):
        for col in (0, 1, 2):
            move(blue, col)
            move(red, col)
            for _ in range(2):
                blue.receive_json()
                red.receive_json()
        move(blue, 3)
        for player in (blue, red):
            state = player.receive_json()
            assert state["evaluation"]["status"] == "won"
            assert state["evaluation"]["winner"] == 1
            assert state["evaluation"]["winning_cells"] == [[5, 0], [5, 1], [5, 2], [5, 3]]

        move(red, 4)
        assert red.receive_json()["detail"] == "The game is over"

        red.send_json({"type": "reset"})
        for player in (blue, red):
            state = player.receive_json()
            assert state["board"] == [[0] * 7 for _ in range(6)]
            assert state["evaluation"]["next_player"] == 1


def test_leaving_frees_the_seat_and_keeps_the_board() -> None:
    with join("abc", "blue-tab") as blue:
        blue.receive_json()
        with join("abc", "red-tab") as red:
            blue.receive_json()
            red.receive_json()
            move(blue, 6)
            blue.receive_json()
            red.receive_json()
            # Close the way a browser does, with a close frame the server reads.
            # (Leaving the block cancels the handler outright instead.)
            red.close()
            assert blue.receive_json()["opponent_connected"] is False

        with join("abc", "another-tab") as newcomer:
            state = newcomer.receive_json()
            assert state["you"] == 2
            assert state["board"][5][6] == 1


def test_reconnecting_tab_reclaims_its_seat_instead_of_taking_the_other() -> None:
    with join("abc", "blue-tab") as first:
        first.receive_json()
        with join("abc", "blue-tab") as again:
            assert again.receive_json()["you"] == 1
            with pytest.raises(WebSocketDisconnect):
                first.receive_json()
            with join("abc", "red-tab") as red:
                assert red.receive_json()["you"] == 2


def test_room_is_forgotten_when_everyone_leaves() -> None:
    with join("abc", "blue-tab") as blue:
        blue.receive_json()
        assert "abc" in main.rooms
    assert main.rooms == {}


def test_room_id_and_token_are_validated() -> None:
    for url in ("/ws/abc", "/ws/not%20ok?token=t", f"/ws/{'x' * 33}?token=t"):
        with pytest.raises(WebSocketDisconnect) as closed:
            with client.websocket_connect(url):
                pass
        assert closed.value.code == 1008
