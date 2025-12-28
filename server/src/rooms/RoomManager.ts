import { GameRoom } from "../game/GameState.ts";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../handlers/types.ts";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private playerConnections: Map<string, ServerWebSocket<WebSocketData>> = new Map();

  createRoom(hostName: string, ws: ServerWebSocket<WebSocketData>): { roomCode: string; playerId: string } {
    let roomCode = generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const playerId = generatePlayerId();
    const room = new GameRoom(roomCode, playerId, hostName);

    this.rooms.set(roomCode, room);
    this.playerToRoom.set(playerId, roomCode);
    this.playerConnections.set(playerId, ws);

    ws.data.playerId = playerId;
    ws.data.roomCode = roomCode;

    return { roomCode, playerId };
  }

  joinRoom(roomCode: string, playerName: string, ws: ServerWebSocket<WebSocketData>, existingPlayerId?: string): { success: boolean; playerId?: string; error?: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    // Handle reconnection
    if (existingPlayerId) {
      const player = room.reconnectPlayer(existingPlayerId);
      if (player) {
        this.playerConnections.set(existingPlayerId, ws);
        ws.data.playerId = existingPlayerId;
        ws.data.roomCode = roomCode;
        return { success: true, playerId: existingPlayerId };
      }
    }

    // New player joining
    const playerId = generatePlayerId();
    room.addPlayer(playerId, playerName);

    this.playerToRoom.set(playerId, roomCode);
    this.playerConnections.set(playerId, ws);

    ws.data.playerId = playerId;
    ws.data.roomCode = roomCode;

    return { success: true, playerId };
  }

  leaveRoom(playerId: string): void {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (room) {
      room.removePlayer(playerId);

      // Clean up empty rooms
      if (room.getConnectedPlayers().length === 0) {
        this.rooms.delete(roomCode);
      }
    }

    this.playerToRoom.delete(playerId);
    this.playerConnections.delete(playerId);
  }

  handleDisconnect(playerId: string): void {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (room) {
      room.removePlayer(playerId);
    }

    this.playerConnections.delete(playerId);
  }

  getRoom(roomCode: string): GameRoom | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  getRoomByPlayer(playerId: string): GameRoom | undefined {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return undefined;
    return this.rooms.get(roomCode);
  }

  getPlayerConnection(playerId: string): ServerWebSocket<WebSocketData> | undefined {
    return this.playerConnections.get(playerId);
  }

  getRoomConnections(roomCode: string): ServerWebSocket<WebSocketData>[] {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return [];

    const connections: ServerWebSocket<WebSocketData>[] = [];
    for (const player of room.getConnectedPlayers()) {
      const ws = this.playerConnections.get(player.id);
      if (ws) {
        connections.push(ws);
      }
    }
    return connections;
  }

  broadcastToRoom(roomCode: string, message: object, excludePlayerId?: string): void {
    const connections = this.getRoomConnections(roomCode);
    const data = JSON.stringify(message);

    for (const ws of connections) {
      if (excludePlayerId && ws.data.playerId === excludePlayerId) continue;
      ws.send(data);
    }
  }

  sendToPlayer(playerId: string, message: object): void {
    const ws = this.playerConnections.get(playerId);
    if (ws) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastStateUpdate(roomCode: string): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return;

    for (const player of room.getConnectedPlayers()) {
      const ws = this.playerConnections.get(player.id);
      if (!ws) continue;

      const state = room.getPublicState(player.id);
      const isSpymaster = player.role === "spymaster";

      ws.send(
        JSON.stringify({
          type: isSpymaster ? "state_update_spymaster" : "state_update",
          state,
        })
      );
    }
  }
}

export const roomManager = new RoomManager();
