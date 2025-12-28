import type { ServerWebSocket } from "bun";
import type { ClientMessage, ServerMessage } from "../../../shared/types.ts";
import { roomManager } from "../rooms/RoomManager.ts";
import type { WebSocketData } from "./types.ts";

function send(ws: ServerWebSocket<WebSocketData>, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

function sendError(ws: ServerWebSocket<WebSocketData>, message: string, code?: string): void {
  send(ws, { type: "error", message, code });
}

export function handleMessage(ws: ServerWebSocket<WebSocketData>, raw: string | Buffer): void {
  let message: ClientMessage;

  try {
    const text = typeof raw === "string" ? raw : raw.toString();
    message = JSON.parse(text) as ClientMessage;
  } catch {
    sendError(ws, "Invalid JSON");
    return;
  }

  switch (message.type) {
    case "ping":
      send(ws, { type: "pong", ts: message.ts });
      break;

    case "create_room":
      handleCreateRoom(ws, message.name);
      break;

    case "join_room":
      handleJoinRoom(ws, message.roomCode, message.name);
      break;

    case "leave_room":
      handleLeaveRoom(ws);
      break;

    case "set_team":
      handleSetTeam(ws, message.team);
      break;

    case "set_role":
      handleSetRole(ws, message.role);
      break;

    case "start_game":
      handleStartGame(ws);
      break;

    case "submit_clue":
      handleSubmitClue(ws, message.word, message.count);
      break;

    case "guess_word":
      handleGuessWord(ws, message.tileId);
      break;

    case "end_turn":
      handleEndTurn(ws);
      break;

    case "request_state":
      handleRequestState(ws);
      break;

    default:
      sendError(ws, "Unknown message type");
  }
}

function handleCreateRoom(ws: ServerWebSocket<WebSocketData>, name: string): void {
  if (!name || name.trim().length === 0) {
    sendError(ws, "Name is required");
    return;
  }

  const { roomCode, playerId } = roomManager.createRoom(name.trim(), ws);
  send(ws, { type: "room_created", roomCode, playerId });

  const room = roomManager.getRoom(roomCode);
  if (room) {
    send(ws, { type: "player_list", players: room.getPlayers() });
  }
}

function handleJoinRoom(ws: ServerWebSocket<WebSocketData>, roomCode: string, name: string): void {
  if (!roomCode || roomCode.trim().length === 0) {
    sendError(ws, "Room code is required");
    return;
  }

  if (!name || name.trim().length === 0) {
    sendError(ws, "Name is required");
    return;
  }

  const result = roomManager.joinRoom(roomCode.trim().toUpperCase(), name.trim(), ws);

  if (!result.success) {
    sendError(ws, result.error || "Failed to join room");
    return;
  }

  send(ws, { type: "room_joined", roomCode: roomCode.toUpperCase(), playerId: result.playerId! });

  const room = roomManager.getRoom(roomCode);
  if (room) {
    roomManager.broadcastToRoom(roomCode, { type: "player_list", players: room.getPlayers() });

    if (room.phase !== "lobby") {
      roomManager.broadcastStateUpdate(roomCode);
    }
  }
}

function handleLeaveRoom(ws: ServerWebSocket<WebSocketData>): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) return;

  roomManager.leaveRoom(playerId);

  const room = roomManager.getRoom(roomCode);
  if (room) {
    roomManager.broadcastToRoom(roomCode, { type: "player_list", players: room.getPlayers() });
  }
}

function handleSetTeam(ws: ServerWebSocket<WebSocketData>, team: "red" | "blue"): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) {
    sendError(ws, "Not in a room");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "Room not found");
    return;
  }

  room.setPlayerTeam(playerId, team);
  roomManager.broadcastToRoom(roomCode, { type: "player_list", players: room.getPlayers() });
}

function handleSetRole(ws: ServerWebSocket<WebSocketData>, role: "spymaster" | "guesser"): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) {
    sendError(ws, "Not in a room");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "Room not found");
    return;
  }

  room.setPlayerRole(playerId, role);
  roomManager.broadcastToRoom(roomCode, { type: "player_list", players: room.getPlayers() });
}

function handleStartGame(ws: ServerWebSocket<WebSocketData>): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) {
    sendError(ws, "Not in a room");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "Room not found");
    return;
  }

  const player = room.getPlayer(playerId);
  if (!player?.isHost) {
    sendError(ws, "Only the host can start the game");
    return;
  }

  const result = room.startGame();
  if (!result.success) {
    sendError(ws, result.error || "Failed to start game");
    return;
  }

  roomManager.broadcastStateUpdate(roomCode);
}

function handleSubmitClue(ws: ServerWebSocket<WebSocketData>, word: string, count: number): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) {
    sendError(ws, "Not in a room");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "Room not found");
    return;
  }

  const result = room.submitClue(playerId, word, count);
  if (!result.success) {
    sendError(ws, result.error || "Failed to submit clue");
    return;
  }

  const turn = room.turn;
  roomManager.broadcastToRoom(roomCode, {
    type: "clue_accepted",
    clue: turn.clue!,
    guessesRemaining: turn.guessesRemaining,
  });

  roomManager.broadcastStateUpdate(roomCode);
}

function handleGuessWord(ws: ServerWebSocket<WebSocketData>, tileId: string): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) {
    sendError(ws, "Not in a room");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "Room not found");
    return;
  }

  const result = room.guessWord(playerId, tileId);
  if (!result.success) {
    sendError(ws, result.error || "Failed to guess");
    return;
  }

  const { color, correct, gameOver, winner } = result.result!;

  roomManager.broadcastToRoom(roomCode, {
    type: "guess_result",
    tileId,
    color,
    correct,
  });

  if (gameOver && winner) {
    const reason = color === "assassin" ? "assassin" : "all_revealed";
    roomManager.broadcastToRoom(roomCode, {
      type: "game_over",
      winner,
      reason,
    });
  } else if (!correct || room.turn.guessesRemaining <= 0) {
    roomManager.broadcastToRoom(roomCode, {
      type: "turn_ended",
      nextTeam: room.turn.team,
    });
  }

  roomManager.broadcastStateUpdate(roomCode);
}

function handleEndTurn(ws: ServerWebSocket<WebSocketData>): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) {
    sendError(ws, "Not in a room");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "Room not found");
    return;
  }

  const result = room.passTurn(playerId);
  if (!result.success) {
    sendError(ws, result.error || "Failed to end turn");
    return;
  }

  roomManager.broadcastToRoom(roomCode, {
    type: "turn_ended",
    nextTeam: room.turn.team,
  });

  roomManager.broadcastStateUpdate(roomCode);
}

function handleRequestState(ws: ServerWebSocket<WebSocketData>): void {
  const { playerId, roomCode } = ws.data;
  if (!playerId || !roomCode) {
    sendError(ws, "Not in a room");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "Room not found");
    return;
  }

  const player = room.getPlayer(playerId);
  const state = room.getPublicState(playerId);
  const isSpymaster = player?.role === "spymaster";

  send(ws, {
    type: isSpymaster ? "state_update_spymaster" : "state_update",
    state,
  } as ServerMessage);
}
