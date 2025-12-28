import { test, expect, describe, beforeEach } from "bun:test";
import { GameRoom } from "./GameState.ts";

describe("GameRoom", () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom("TEST", "host-1", "Host");
  });

  describe("player management", () => {
    test("creates room with host player", () => {
      const players = room.getPlayers();
      expect(players.length).toBe(1);
      expect(players[0]?.name).toBe("Host");
      expect(players[0]?.isHost).toBe(true);
      expect(players[0]?.isConnected).toBe(true);
    });

    test("adds new player", () => {
      room.addPlayer("player-2", "Player 2");
      const players = room.getPlayers();
      expect(players.length).toBe(2);
      expect(players[1]?.name).toBe("Player 2");
      expect(players[1]?.isHost).toBe(false);
    });

    test("reconnects existing player", () => {
      room.removePlayer("host-1");
      expect(room.getPlayer("host-1")?.isConnected).toBe(false);

      room.reconnectPlayer("host-1");
      expect(room.getPlayer("host-1")?.isConnected).toBe(true);
    });

    test("transfers host on disconnect", () => {
      room.addPlayer("player-2", "Player 2");
      room.removePlayer("host-1");

      expect(room.getPlayer("host-1")?.isHost).toBe(false);
      expect(room.getPlayer("player-2")?.isHost).toBe(true);
    });

    test("sets player team", () => {
      room.setPlayerTeam("host-1", "red");
      expect(room.getPlayer("host-1")?.team).toBe("red");
    });

    test("sets player role", () => {
      room.setPlayerRole("host-1", "spymaster");
      expect(room.getPlayer("host-1")?.role).toBe("spymaster");
    });
  });

  describe("game start validation", () => {
    test("fails without enough players", () => {
      const result = room.startGame();
      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 2 players");
    });

    test("fails without spymasters", () => {
      setupMinimalTeams(room);
      room.setPlayerRole("p1", "guesser");
      room.setPlayerRole("p2", "guesser");
      room.setPlayerRole("p3", "guesser");
      room.setPlayerRole("p4", "guesser");

      const result = room.startGame();
      expect(result.success).toBe(false);
      expect(result.error).toContain("spymaster");
    });

    test("succeeds with valid teams", () => {
      setupMinimalTeams(room);
      const result = room.startGame();
      expect(result.success).toBe(true);
    });
  });

  describe("clue submission", () => {
    beforeEach(() => {
      setupMinimalTeams(room);
      room.startGame();
    });

    test("spymaster can submit clue on their turn", () => {
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      const result = room.submitClue(spymaster!.id, "HINT", 2);
      expect(result.success).toBe(true);
    });

    test("guesser cannot submit clue", () => {
      const guesser = room.getPlayers().find(
        (p) => p.role === "guesser" && p.team === room.turn.team
      );
      const result = room.submitClue(guesser!.id, "HINT", 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain("spymaster");
    });

    test("wrong team cannot submit clue", () => {
      const wrongSpymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team !== room.turn.team
      );
      const result = room.submitClue(wrongSpymaster!.id, "HINT", 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain("turn");
    });

    test("rejects clue that matches board word", () => {
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      const boardWord = room.getFullState().board[0]!.word;
      const result = room.submitClue(spymaster!.id, boardWord, 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain("board");
    });

    test("rejects empty clue", () => {
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      const result = room.submitClue(spymaster!.id, "", 2);
      expect(result.success).toBe(false);
    });

    test("sets guesses remaining to count + 1", () => {
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      room.submitClue(spymaster!.id, "HINT", 3);
      expect(room.turn.guessesRemaining).toBe(4);
    });
  });

  describe("guessing", () => {
    beforeEach(() => {
      setupMinimalTeams(room);
      room.startGame();
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      room.submitClue(spymaster!.id, "HINT", 2);
    });

    test("guesser can guess on their turn", () => {
      const guesser = room.getPlayers().find(
        (p) => p.role === "guesser" && p.team === room.turn.team
      );
      const tile = room.getFullState().board[0]!;
      const result = room.guessWord(guesser!.id, tile.id);
      expect(result.success).toBe(true);
      expect(result.result?.color).toBeDefined();
    });

    test("spymaster cannot guess", () => {
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      const tile = room.getFullState().board[0]!;
      const result = room.guessWord(spymaster!.id, tile.id);
      expect(result.success).toBe(false);
    });

    test("cannot guess already revealed tile", () => {
      const guesser = room.getPlayers().find(
        (p) => p.role === "guesser" && p.team === room.turn.team
      );
      const tile = room.getFullState().board[0]!;
      room.guessWord(guesser!.id, tile.id);
      const result = room.guessWord(guesser!.id, tile.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain("revealed");
    });

    test("wrong guess ends turn", () => {
      const guesser = room.getPlayers().find(
        (p) => p.role === "guesser" && p.team === room.turn.team
      );
      const currentTeam = room.turn.team;

      // Find a tile that's not the current team's color
      const state = room.getFullState();
      const wrongTile = state.board.find((t) => t.color !== currentTeam && t.color !== "assassin");

      room.guessWord(guesser!.id, wrongTile!.id);
      expect(room.turn.team).not.toBe(currentTeam);
    });

    test("assassin ends game", () => {
      const guesser = room.getPlayers().find(
        (p) => p.role === "guesser" && p.team === room.turn.team
      );
      const state = room.getFullState();
      const assassinTile = state.board.find((t) => t.color === "assassin");

      const result = room.guessWord(guesser!.id, assassinTile!.id);
      expect(result.result?.gameOver).toBe(true);
      expect(room.phase).toBe("game_over");
    });
  });

  describe("turn management", () => {
    beforeEach(() => {
      setupMinimalTeams(room);
      room.startGame();
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      room.submitClue(spymaster!.id, "HINT", 2);
    });

    test("guesser can pass turn", () => {
      const guesser = room.getPlayers().find(
        (p) => p.role === "guesser" && p.team === room.turn.team
      );
      const currentTeam = room.turn.team;

      const result = room.passTurn(guesser!.id);
      expect(result.success).toBe(true);
      expect(room.turn.team).not.toBe(currentTeam);
    });

    test("spymaster cannot pass", () => {
      const spymaster = room.getPlayers().find(
        (p) => p.role === "spymaster" && p.team === room.turn.team
      );
      const result = room.passTurn(spymaster!.id);
      expect(result.success).toBe(false);
    });
  });

  describe("state filtering", () => {
    beforeEach(() => {
      setupMinimalTeams(room);
      room.startGame();
    });

    test("spymaster sees all tile colors", () => {
      const spymaster = room.getPlayers().find((p) => p.role === "spymaster");
      const state = room.getPublicState(spymaster!.id);

      const colorsVisible = state.board.filter((t) => t.color !== undefined).length;
      expect(colorsVisible).toBe(25);
    });

    test("guesser only sees revealed tile colors", () => {
      const guesser = room.getPlayers().find((p) => p.role === "guesser");
      const state = room.getPublicState(guesser!.id);

      const colorsVisible = state.board.filter((t) => t.color !== undefined).length;
      expect(colorsVisible).toBe(0); // None revealed yet
    });

    test("guesser does not see keyCard", () => {
      const guesser = room.getPlayers().find((p) => p.role === "guesser");
      const state = room.getPublicState(guesser!.id);

      expect((state as any).keyCard).toBeUndefined();
    });
  });

  describe("revision tracking", () => {
    test("increments revision on player add", () => {
      const rev1 = room.currentRevision;
      room.addPlayer("p2", "Player 2");
      expect(room.currentRevision).toBeGreaterThan(rev1);
    });

    test("increments revision on team change", () => {
      const rev1 = room.currentRevision;
      room.setPlayerTeam("host-1", "red");
      expect(room.currentRevision).toBeGreaterThan(rev1);
    });

    test("increments revision on game start", () => {
      setupMinimalTeams(room);
      const rev1 = room.currentRevision;
      room.startGame();
      expect(room.currentRevision).toBeGreaterThan(rev1);
    });
  });
});

function setupMinimalTeams(room: GameRoom) {
  // Add 3 more players (host is already there)
  room.addPlayer("p1", "Red Spy");
  room.addPlayer("p2", "Red Guesser");
  room.addPlayer("p3", "Blue Spy");
  room.addPlayer("p4", "Blue Guesser");

  // Set up red team
  room.setPlayerTeam("host-1", "red");
  room.setPlayerRole("host-1", "guesser");
  room.setPlayerTeam("p1", "red");
  room.setPlayerRole("p1", "spymaster");
  room.setPlayerTeam("p2", "red");
  room.setPlayerRole("p2", "guesser");

  // Set up blue team
  room.setPlayerTeam("p3", "blue");
  room.setPlayerRole("p3", "spymaster");
  room.setPlayerTeam("p4", "blue");
  room.setPlayerRole("p4", "guesser");
}
