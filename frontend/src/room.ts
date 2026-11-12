// The WebSocket protocol shared with backend/main.py, and how a tab finds its room.
import type { Board, Evaluation, Player } from "./game";

export type GameState = {
  type: "state";
  you: Player;
  board: Board;
  evaluation: Evaluation;
  opponent_connected: boolean;
};

export type ServerMessage = GameState | { type: "error"; detail: string };

export type ClientMessage = { type: "move"; col: number } | { type: "reset" };

const ROOM_PATTERN = /^[\w-]{1,32}$/;
const TOKEN_KEY = "connect-four-token";

// The room comes from ?room= in the address bar, so sharing the URL invites the
// opponent. A tab without one starts a fresh room and puts it in the URL.
export function roomFromUrl(): string {
  const url = new URL(window.location.href);
  let room = url.searchParams.get("room");
  if (room === null || !ROOM_PATTERN.test(room)) {
    room = crypto.randomUUID().slice(0, 8);
    url.searchParams.set("room", room);
    window.history.replaceState(null, "", url);
  }
  return room;
}

// One token per browser tab: a refresh reclaims the same seat, and two tabs in
// the same browser are two different players.
export function tabToken(): string {
  let token = sessionStorage.getItem(TOKEN_KEY);
  if (token === null) {
    token = crypto.randomUUID();
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function socketUrl(room: string, token: string): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws/${room}?token=${encodeURIComponent(token)}`;
}
