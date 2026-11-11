from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_empty_board_now_winners() -> None:
    response = client.post("/evaluate_board_state", json={"board": [[0] * 6] * 7})

    assert response.status_code == 200
    assert response.json() == {"in_progress": "ok"}

# TODO(me): FIX JSON RESPONSE


"""
To implement later
test_horizontal_win
test_vertical_win
test_pos_diagonal_win
test_neg_diagonal_win
test_draw
test_validation_wrong_board_size

"""
