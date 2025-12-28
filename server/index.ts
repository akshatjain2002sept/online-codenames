import { handleMessage } from "./src/handlers/messageHandler.ts";
import { roomManager } from "./src/rooms/RoomManager.ts";
import type { WebSocketData } from "./src/handlers/types.ts";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const server = Bun.serve<WebSocketData>({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: {} as WebSocketData,
      });

      if (upgraded) {
        return undefined;
      }

      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log(`[WS] Client connected`);
    },

    message(ws, message) {
      handleMessage(ws, message);
    },

    close(ws) {
      const { playerId, roomCode } = ws.data;
      console.log(`[WS] Client disconnected: ${playerId || "unknown"}`);

      if (playerId) {
        roomManager.handleDisconnect(playerId);

        if (roomCode) {
          const room = roomManager.getRoom(roomCode);
          if (room) {
            roomManager.broadcastToRoom(roomCode, {
              type: "player_list",
              players: room.getPlayers(),
            });
          }
        }
      }
    },

    error(ws, error) {
      console.error(`[WS] Error:`, error);
    },
  },
});

console.log(`🎮 Codenames server running at http://localhost:${server.port}`);
console.log(`📡 WebSocket endpoint: ws://localhost:${server.port}/ws`);
