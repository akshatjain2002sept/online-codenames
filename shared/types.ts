export type Team = "red" | "blue";

export type Role = "spymaster" | "guesser";

export type GamePhase = "lobby" | "clue" | "guess" | "game_over";

export type TileColor = "red" | "blue" | "neutral" | "assassin";

export interface Player {
  id: string;
  name: string;
  team?: Team;
  role?: Role;
  isConnected: boolean;
  isHost: boolean;
}

export interface WordTile {
  id: string;
  word: string;
  isRevealed: boolean;
  color?: TileColor;
}

export interface KeyCard {
  tiles: TileColor[];
  startingTeam: Team;
}

export interface Clue {
  word: string;
  count: number;
  givenBy: string;
  givenAt: string;
}

export interface TurnState {
  team: Team;
  phase: GamePhase;
  guessesRemaining: number;
  clue?: Clue;
}

export interface GameState {
  roomCode: string;
  createdAt: string;
  phase: GamePhase;
  players: Player[];
  board: WordTile[];
  keyCard: KeyCard;
  turn: TurnState;
  winner?: Team;
}

export type PublicWordTile = Omit<WordTile, "color"> & {
  color?: TileColor;
};

export type PublicGameState = Omit<GameState, "keyCard" | "board"> & {
  board: PublicWordTile[];
};

export type ClientMessage =
  | { type: "create_room"; name: string }
  | { type: "join_room"; roomCode: string; name: string }
  | { type: "leave_room" }
  | { type: "set_team"; team: Team }
  | { type: "set_role"; role: Role }
  | { type: "set_ready"; ready: boolean }
  | { type: "start_game" }
  | { type: "submit_clue"; word: string; count: number }
  | { type: "guess_word"; tileId: string }
  | { type: "end_turn" }
  | { type: "request_state" }
  | { type: "ping"; ts: number };

export type ServerMessage =
  | { type: "room_created"; roomCode: string; playerId: string }
  | { type: "room_joined"; roomCode: string; playerId: string }
  | { type: "player_list"; players: Player[] }
  | { type: "state_update"; state: PublicGameState }
  | { type: "state_update_spymaster"; state: GameState }
  | { type: "clue_accepted"; clue: Clue; guessesRemaining: number }
  | { type: "guess_result"; tileId: string; color: TileColor; correct: boolean }
  | { type: "turn_ended"; nextTeam: Team }
  | { type: "game_over"; winner: Team; reason: "assassin" | "all_revealed" }
  | { type: "error"; message: string; code?: string }
  | { type: "pong"; ts: number };
