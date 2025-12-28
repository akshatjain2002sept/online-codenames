import { test, expect } from "bun:test";
import { handleMessage } from "../server/src/handlers/messageHandler.ts";
import { roomManager } from "../server/src/rooms/RoomManager.ts";
import type { ClientMessage, GameState, ServerMessage } from "../shared/types.ts";
import type { WebSocketData } from "../server/src/handlers/types.ts";

type Message = ServerMessage;

class FakeWebSocket {
  data: WebSocketData = {};
  sent: Message[] = [];

  send(payload: string): void {
    this.sent.push(JSON.parse(payload) as Message);
  }

  clear(): void {
    this.sent = [];
  }
}

type RoomManagerInternals = {
  rooms: Map<string, unknown>;
  playerToRoom: Map<string, string>;
  playerConnections: Map<string, unknown>;
};

function resetRoomManager(): void {
  const manager = roomManager as unknown as RoomManagerInternals;
  manager.rooms.clear();
  manager.playerToRoom.clear();
  manager.playerConnections.clear();
}

function send(ws: FakeWebSocket, message: ClientMessage): void {
  handleMessage(ws as unknown as any, JSON.stringify(message));
}

function lastMessage<T extends Message["type"]>(ws: FakeWebSocket, type: T): Extract<Message, { type: T }> | undefined {
  for (let i = ws.sent.length - 1; i >= 0; i--) {
    const message = ws.sent[i];
    if (message.type === type) {
      return message as Extract<Message, { type: T }>;
    }
  }
  return undefined;
}

test("websocket message flow: create, join, start, clue, guess", () => {
  resetRoomManager();

  const host = new FakeWebSocket();
  send(host, { type: "create_room", name: "Host" });

  const created = lastMessage(host, "room_created");
  expect(created?.roomCode).toBeDefined();
  expect(created?.playerId).toBeDefined();
  expect(host.data.roomCode).toBe(created?.roomCode);

  const roomCode = created!.roomCode;
  host.clear();

  const redGuesser = new FakeWebSocket();
  send(redGuesser, { type: "join_room", roomCode, name: "RedGuesser" });

  const blueSpymaster = new FakeWebSocket();
  send(blueSpymaster, { type: "join_room", roomCode, name: "BlueSpy" });

  const blueGuesser = new FakeWebSocket();
  send(blueGuesser, { type: "join_room", roomCode, name: "BlueGuesser" });

  const roster = lastMessage(host, "player_list");
  expect(roster?.players.length).toBe(4);

  // Assign teams and roles in lobby
  send(host, { type: "set_team", team: "red" });
  send(host, { type: "set_role", role: "spymaster" });
  send(redGuesser, { type: "set_team", team: "red" });
  send(redGuesser, { type: "set_role", role: "guesser" });
  send(blueSpymaster, { type: "set_team", team: "blue" });
  send(blueSpymaster, { type: "set_role", role: "spymaster" });
  send(blueGuesser, { type: "set_team", team: "blue" });
  send(blueGuesser, { type: "set_role", role: "guesser" });

  send(host, { type: "start_game" });

  const hostState = lastMessage(host, "state_update_spymaster");
  const blueState = lastMessage(blueSpymaster, "state_update_spymaster");
  const redGuesserState = lastMessage(redGuesser, "state_update");
  const blueGuesserState = lastMessage(blueGuesser, "state_update");

  expect(hostState).toBeDefined();
  expect(blueState).toBeDefined();
  expect(redGuesserState).toBeDefined();
  expect(blueGuesserState).toBeDefined();

  const spymasterState = (hostState?.state ?? blueState?.state) as GameState;
  const activeTeam = spymasterState.turn.team;
  const activeSpymaster = activeTeam === "red" ? host : blueSpymaster;
  const activeGuesser = activeTeam === "red" ? redGuesser : blueGuesser;

  send(activeSpymaster, { type: "submit_clue", word: "Test", count: 1 });
  const clueAccepted = lastMessage(activeSpymaster, "clue_accepted");
  expect(clueAccepted?.clue.word).toBe("TEST");

  const updatedState = lastMessage(activeSpymaster, "state_update_spymaster");
  const board = (updatedState?.state as GameState).board;
  const target = board.find((tile) => tile.color === activeTeam && !tile.isRevealed) ?? board[0]!;

  send(activeGuesser, { type: "guess_word", tileId: target.id });
  const guessResult = lastMessage(activeGuesser, "guess_result") ?? lastMessage(activeSpymaster, "guess_result");
  expect(guessResult?.tileId).toBe(target.id);
});
