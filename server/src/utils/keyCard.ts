import type { KeyCard, Team, TileColor } from "../../shared/types.ts";

export function generateKeyCard(startingTeam: Team = Math.random() < 0.5 ? "red" : "blue"): KeyCard {
  const tiles: TileColor[] = [];

  // Starting team gets 9 cards, other team gets 8
  const startingTeamCount = 9;
  const otherTeamCount = 8;
  const neutralCount = 7;
  const assassinCount = 1;

  // Add tiles for starting team
  for (let i = 0; i < startingTeamCount; i++) {
    tiles.push(startingTeam);
  }

  // Add tiles for other team
  const otherTeam: Team = startingTeam === "red" ? "blue" : "red";
  for (let i = 0; i < otherTeamCount; i++) {
    tiles.push(otherTeam);
  }

  // Add neutral tiles
  for (let i = 0; i < neutralCount; i++) {
    tiles.push("neutral");
  }

  // Add assassin
  for (let i = 0; i < assassinCount; i++) {
    tiles.push("assassin");
  }

  // Shuffle tiles
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }

  return {
    tiles,
    startingTeam,
  };
}
