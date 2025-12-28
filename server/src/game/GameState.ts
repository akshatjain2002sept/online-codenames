import type {
  GameState,
  Player,
  WordTile,
  KeyCard,
  Team,
  Role,
  GamePhase,
  TileColor,
  Clue,
  TurnState,
  PublicGameState,
  PublicWordTile,
} from "../../../shared/types.ts";
import { generateKeyCard } from "../utils/keyCard.ts";
import { getRandomWords } from "../utils/words.ts";

export class GameRoom {
  private state: GameState;
  private revision: number = 0;

  constructor(roomCode: string, hostId: string, hostName: string) {
    this.state = {
      roomCode,
      createdAt: new Date().toISOString(),
      phase: "lobby",
      players: [
        {
          id: hostId,
          name: hostName,
          isConnected: true,
          isHost: true,
        },
      ],
      board: [],
      keyCard: { tiles: [], startingTeam: "red" },
      turn: {
        team: "red",
        phase: "lobby",
        guessesRemaining: 0,
      },
    };
  }

  get roomCode(): string {
    return this.state.roomCode;
  }

  get currentRevision(): number {
    return this.revision;
  }

  private incrementRevision(): void {
    this.revision++;
  }

  // Player management
  addPlayer(id: string, name: string): Player {
    const existing = this.state.players.find((p) => p.id === id);
    if (existing) {
      existing.isConnected = true;
      existing.name = name;
      this.incrementRevision();
      return existing;
    }

    const player: Player = {
      id,
      name,
      isConnected: true,
      isHost: false,
    };
    this.state.players.push(player);
    this.incrementRevision();
    return player;
  }

  removePlayer(id: string): boolean {
    const index = this.state.players.findIndex((p) => p.id === id);
    if (index === -1) return false;

    const player = this.state.players[index]!;
    player.isConnected = false;
    this.incrementRevision();

    // If host disconnects, assign new host
    if (player.isHost) {
      const connected = this.state.players.find((p) => p.isConnected);
      if (connected) {
        connected.isHost = true;
        player.isHost = false;
      }
    }

    return true;
  }

  reconnectPlayer(id: string): Player | null {
    const player = this.state.players.find((p) => p.id === id);
    if (player) {
      player.isConnected = true;
      this.incrementRevision();
      return player;
    }
    return null;
  }

  getPlayer(id: string): Player | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  getPlayers(): Player[] {
    return this.state.players;
  }

  getConnectedPlayers(): Player[] {
    return this.state.players.filter((p) => p.isConnected);
  }

  setPlayerTeam(playerId: string, team: Team): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player && this.state.phase === "lobby") {
      player.team = team;
      // Auto-assign as guesser when joining a team
      if (!player.role) {
        player.role = "guesser";
      }
      this.incrementRevision();
    }
  }

  setPlayerRole(playerId: string, role: Role): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player && this.state.phase === "lobby") {
      player.role = role;
      this.incrementRevision();
    }
  }

  // Game initialization
  startGame(): { success: boolean; error?: string } {
    // Validate teams
    const redTeam = this.state.players.filter((p) => p.team === "red");
    const blueTeam = this.state.players.filter((p) => p.team === "blue");

    if (redTeam.length < 2 || blueTeam.length < 2) {
      return { success: false, error: "Each team needs at least 2 players" };
    }

    const redSpymaster = redTeam.find((p) => p.role === "spymaster");
    const blueSpymaster = blueTeam.find((p) => p.role === "spymaster");

    if (!redSpymaster || !blueSpymaster) {
      return { success: false, error: "Each team needs a spymaster" };
    }

    // Generate board
    const words = getRandomWords(25);
    this.state.keyCard = generateKeyCard();
    this.state.board = words.map((word, index) => ({
      id: `tile-${index}`,
      word,
      isRevealed: false,
      color: this.state.keyCard.tiles[index],
    }));

    // Set initial turn
    this.state.turn = {
      team: this.state.keyCard.startingTeam,
      phase: "clue",
      guessesRemaining: 0,
    };
    this.state.phase = "clue";
    this.incrementRevision();

    return { success: true };
  }

  // Clue submission
  submitClue(playerId: string, word: string, count: number): { success: boolean; error?: string } {
    const validation = this.assertCanSubmitClue(playerId, word);
    if (!validation.success) return validation;

    const player = this.getPlayer(playerId)!;
    const clue: Clue = {
      word: word.toUpperCase(),
      count,
      givenBy: player.name,
      givenAt: new Date().toISOString(),
    };

    this.state.turn.clue = clue;
    this.state.turn.phase = "guess";
    this.state.phase = "guess";
    // count + 1 for unlimited = 0, otherwise count + 1 guesses allowed
    this.state.turn.guessesRemaining = count === 0 ? Infinity : count + 1;
    this.incrementRevision();

    return { success: true };
  }

  private assertCanSubmitClue(playerId: string, word: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: "Player not found" };
    if (player.role !== "spymaster") return { success: false, error: "Only spymasters can give clues" };
    if (player.team !== this.state.turn.team) return { success: false, error: "Not your team's turn" };
    if (this.state.turn.phase !== "clue") return { success: false, error: "Not in clue phase" };

    // Validate clue word
    const validation = this.validateClueWord(word);
    if (!validation.valid) return { success: false, error: validation.error };

    return { success: true };
  }

  private validateClueWord(word: string): { valid: boolean; error?: string } {
    const normalized = word.toUpperCase().trim();

    if (!normalized || normalized.length === 0) {
      return { valid: false, error: "Clue cannot be empty" };
    }

    if (!/^[A-Z]+$/i.test(normalized)) {
      return { valid: false, error: "Clue must contain only letters" };
    }

    // Check if clue matches any board word
    for (const tile of this.state.board) {
      if (tile.word.toUpperCase() === normalized) {
        return { valid: false, error: "Clue cannot be a word on the board" };
      }
      // Check if clue is a substring or contains a board word
      if (tile.word.toUpperCase().includes(normalized) || normalized.includes(tile.word.toUpperCase())) {
        if (tile.word.toUpperCase() !== normalized) {
          return { valid: false, error: `Clue cannot contain or be part of board word: ${tile.word}` };
        }
      }
    }

    return { valid: true };
  }

  // Guessing
  guessWord(playerId: string, tileId: string): { success: boolean; error?: string; result?: { color: TileColor; correct: boolean; gameOver?: boolean; winner?: Team } } {
    const validation = this.assertCanGuess(playerId, tileId);
    if (!validation.success) return validation;

    const tile = this.state.board.find((t) => t.id === tileId)!;
    tile.isRevealed = true;
    this.state.turn.guessesRemaining--;
    this.incrementRevision();

    const color = tile.color!;
    const currentTeam = this.state.turn.team;
    const correct = color === currentTeam;

    // Check win/loss conditions
    if (color === "assassin") {
      const winner = currentTeam === "red" ? "blue" : "red";
      this.endGame(winner);
      return {
        success: true,
        result: { color, correct: false, gameOver: true, winner },
      };
    }

    // Check if team revealed all their words
    const winCheck = this.checkWinCondition();
    if (winCheck) {
      this.endGame(winCheck);
      return {
        success: true,
        result: { color, correct, gameOver: true, winner: winCheck },
      };
    }

    // If wrong color or out of guesses, end turn
    if (!correct || this.state.turn.guessesRemaining <= 0) {
      this.endTurn();
    }

    return { success: true, result: { color, correct } };
  }

  private assertCanGuess(playerId: string, tileId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: "Player not found" };
    if (player.role !== "guesser") return { success: false, error: "Only guessers can guess" };
    if (player.team !== this.state.turn.team) return { success: false, error: "Not your team's turn" };
    if (this.state.turn.phase !== "guess") return { success: false, error: "Not in guess phase" };

    const tile = this.state.board.find((t) => t.id === tileId);
    if (!tile) return { success: false, error: "Tile not found" };
    if (tile.isRevealed) return { success: false, error: "Tile already revealed" };

    return { success: true };
  }

  // Turn management
  endTurn(): void {
    const nextTeam: Team = this.state.turn.team === "red" ? "blue" : "red";
    this.state.turn = {
      team: nextTeam,
      phase: "clue",
      guessesRemaining: 0,
    };
    this.state.phase = "clue";
    this.incrementRevision();
  }

  passTurn(playerId: string): { success: boolean; error?: string } {
    const validation = this.assertCanPass(playerId);
    if (!validation.success) return validation;

    this.endTurn();
    return { success: true };
  }

  private assertCanPass(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: "Player not found" };
    if (player.role !== "guesser") return { success: false, error: "Only guessers can pass" };
    if (player.team !== this.state.turn.team) return { success: false, error: "Not your team's turn" };
    if (this.state.turn.phase !== "guess") return { success: false, error: "Not in guess phase" };

    return { success: true };
  }

  // Win condition
  private checkWinCondition(): Team | null {
    const redTiles = this.state.board.filter((t) => t.color === "red");
    const blueTiles = this.state.board.filter((t) => t.color === "blue");

    const redRevealed = redTiles.filter((t) => t.isRevealed).length;
    const blueRevealed = blueTiles.filter((t) => t.isRevealed).length;

    if (redRevealed === redTiles.length) return "red";
    if (blueRevealed === blueTiles.length) return "blue";

    return null;
  }

  private endGame(winner: Team): void {
    this.state.phase = "game_over";
    this.state.turn.phase = "game_over";
    this.state.winner = winner;
    this.incrementRevision();
  }

  // State filtering
  getFullState(): GameState {
    return { ...this.state };
  }

  getPublicState(playerId: string): PublicGameState {
    const player = this.getPlayer(playerId);
    const isSpymaster = player?.role === "spymaster";

    const publicBoard: PublicWordTile[] = this.state.board.map((tile) => ({
      id: tile.id,
      word: tile.word,
      isRevealed: tile.isRevealed,
      // Only show color if revealed, or if player is spymaster
      color: tile.isRevealed ? tile.color : (isSpymaster ? tile.color : undefined),
    }));

    // Spymasters get full state, guessers get filtered state
    if (isSpymaster) {
      return {
        roomCode: this.state.roomCode,
        createdAt: this.state.createdAt,
        phase: this.state.phase,
        players: this.state.players,
        board: publicBoard,
        turn: this.state.turn,
        winner: this.state.winner,
        keyCard: this.state.keyCard,
      } as GameState;
    }

    return {
      roomCode: this.state.roomCode,
      createdAt: this.state.createdAt,
      phase: this.state.phase,
      players: this.state.players,
      board: publicBoard,
      turn: this.state.turn,
      winner: this.state.winner,
    };
  }

  get phase(): GamePhase {
    return this.state.phase;
  }

  get turn(): TurnState {
    return this.state.turn;
  }

  get winner(): Team | undefined {
    return this.state.winner;
  }
}
