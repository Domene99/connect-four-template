from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def empty_board() -> list[list[int]]:
    return [[0] * 7 for _ in range(6)]


def with_pieces(*pieces: tuple[int, int, int]) -> list[list[int]]:
    board = empty_board()
    for row, col, player in pieces:
        board[row][col] = player
    return board


def evaluate(board: list[list[int]]) -> dict:
    response = client.post("/evaluate_board_state", json={"board": board})
    assert response.status_code == 200, response.text
    return response.json()


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_empty_board_is_blues_turn() -> None:
    assert evaluate(empty_board()) == {
        "status": "in_progress",
        "winner": None,
        "next_player": 1,
        "winning_cells": [],
        "detail": None,
    }


def test_next_player_alternates() -> None:
    one_move = evaluate(with_pieces((5, 0, 1)))
    assert one_move["status"] == "in_progress"
    assert one_move["next_player"] == 2

    two_moves = evaluate(with_pieces((5, 0, 1), (5, 1, 2)))
    assert two_moves["next_player"] == 1


def test_horizontal_win() -> None:
    # Four blue pieces on the bottom, three red pieces beside them.
    board = with_pieces(
        (5, 0, 1),
        (5, 1, 1),
        (5, 2, 1),
        (5, 3, 1),
        (5, 4, 2),
        (5, 5, 2),
        (5, 6, 2),
    )
    result = evaluate(board)
    assert result["status"] == "won"
    assert result["winner"] == 1
    assert result["next_player"] is None
    assert result["winning_cells"] == [[5, 0], [5, 1], [5, 2], [5, 3]]


def test_vertical_win_in_last_column() -> None:
    board = with_pieces(
        (2, 6, 1),
        (3, 6, 1),
        (4, 6, 1),
        (5, 6, 1),
        (3, 0, 2),
        (4, 0, 2),
        (5, 0, 2),
    )
    result = evaluate(board)
    assert result["status"] == "won"
    assert result["winner"] == 1
    assert result["winning_cells"] == [[2, 6], [3, 6], [4, 6], [5, 6]]


def test_down_right_diagonal_win() -> None:
    board = with_pieces(
        (2, 0, 1),
        (3, 1, 1),
        (4, 2, 1),
        (5, 3, 1),
        (5, 1, 1),
        (5, 4, 1),
        (3, 0, 2),
        (4, 0, 2),
        (4, 1, 2),
        (5, 0, 2),
        (5, 2, 2),
    )
    result = evaluate(board)
    assert result["winner"] == 1
    assert [2, 0] in result["winning_cells"]
    assert [5, 3] in result["winning_cells"]


def test_down_left_diagonal_win() -> None:
    board = with_pieces(
        (2, 3, 1),
        (3, 2, 1),
        (4, 1, 1),
        (5, 0, 1),
        (5, 3, 1),
        (5, 4, 1),
        (3, 3, 2),
        (4, 2, 2),
        (4, 3, 2),
        (5, 1, 2),
        (5, 2, 2),
    )
    result = evaluate(board)
    assert result["winner"] == 1
    assert [2, 3] in result["winning_cells"]
    assert [5, 0] in result["winning_cells"]


def test_red_win() -> None:
    board = with_pieces(
        (4, 0, 1),
        (5, 0, 2),
        (5, 1, 2),
        (5, 2, 2),
        (5, 3, 2),
        (5, 4, 1),
        (5, 5, 1),
        (5, 6, 1),
    )
    result = evaluate(board)
    assert result["status"] == "won"
    assert result["winner"] == 2
    assert result["winning_cells"] == [[5, 0], [5, 1], [5, 2], [5, 3]]


def test_draw() -> None:
    # 2x2 tiles. Runs stay at length 2 in every direction, and counts are 21-21.
    pattern = (
        "1122112",
        "2211221",
        "1122112",
        "2211221",
        "1122112",
        "2211221",
    )
    board = [[int(cell) for cell in row] for row in pattern]
    assert evaluate(board) == {
        "status": "tied",
        "winner": None,
        "next_player": None,
        "winning_cells": [],
        "detail": None,
    }


def test_wrong_board_size() -> None:
    response = client.post("/evaluate_board_state", json={"board": [[0] * 6] * 7})
    assert response.status_code == 422
    assert "6 rows" in response.text


def test_invalid_cell_value() -> None:
    board = empty_board()
    board[5][0] = 9
    response = client.post("/evaluate_board_state", json={"board": board})
    assert response.status_code == 422


def test_floating_piece_is_impossible() -> None:
    result = evaluate(with_pieces((4, 0, 1)))
    assert result["status"] == "impossible"
    assert "floating" in result["detail"]


def test_red_moving_first_is_impossible() -> None:
    result = evaluate(with_pieces((5, 0, 2)))
    assert result["status"] == "impossible"
    assert "counts" in result["detail"]


def test_both_players_winning_is_impossible() -> None:
    board = with_pieces(
        (4, 0, 1),
        (4, 1, 1),
        (4, 2, 1),
        (4, 3, 1),
        (5, 0, 2),
        (5, 1, 2),
        (5, 2, 2),
        (5, 3, 2),
    )
    result = evaluate(board)
    assert result["status"] == "impossible"
    assert result["winner"] is None


def test_play_continued_after_a_win() -> None:
    # Two separate blue vertical fours, with red's replies stacked legally.
    # No single blue piece is the one that finished the only connect four.
    pieces: list[tuple[int, int, int]] = []
    for row in range(2, 6):
        pieces.append((row, 0, 1))
        pieces.append((row, 2, 1))
    for row in range(3, 6):
        pieces.append((row, 1, 2))
        pieces.append((row, 3, 2))
    pieces.append((5, 4, 2))
    result = evaluate(with_pieces(*pieces))
    assert result["status"] == "impossible"
    assert "already won" in result["detail"]
