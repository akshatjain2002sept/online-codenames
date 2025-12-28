import { test, expect, describe } from "bun:test";
import { generateKeyCard } from "./keyCard.ts";

describe("generateKeyCard", () => {
  test("generates 25 tiles", () => {
    const keyCard = generateKeyCard();
    expect(keyCard.tiles.length).toBe(25);
  });

  test("starting team gets 9 tiles", () => {
    const keyCard = generateKeyCard("red");
    const redCount = keyCard.tiles.filter((t) => t === "red").length;
    expect(redCount).toBe(9);
    expect(keyCard.startingTeam).toBe("red");
  });

  test("other team gets 8 tiles", () => {
    const keyCard = generateKeyCard("red");
    const blueCount = keyCard.tiles.filter((t) => t === "blue").length;
    expect(blueCount).toBe(8);
  });

  test("has 7 neutral tiles", () => {
    const keyCard = generateKeyCard();
    const neutralCount = keyCard.tiles.filter((t) => t === "neutral").length;
    expect(neutralCount).toBe(7);
  });

  test("has exactly 1 assassin", () => {
    const keyCard = generateKeyCard();
    const assassinCount = keyCard.tiles.filter((t) => t === "assassin").length;
    expect(assassinCount).toBe(1);
  });

  test("blue starting team gets 9 blue tiles", () => {
    const keyCard = generateKeyCard("blue");
    const blueCount = keyCard.tiles.filter((t) => t === "blue").length;
    const redCount = keyCard.tiles.filter((t) => t === "red").length;
    expect(blueCount).toBe(9);
    expect(redCount).toBe(8);
    expect(keyCard.startingTeam).toBe("blue");
  });

  test("tiles are shuffled (not in order)", () => {
    const keyCard1 = generateKeyCard("red");
    const keyCard2 = generateKeyCard("red");
    // Very unlikely to be identical if shuffled
    const same = keyCard1.tiles.every((t, i) => t === keyCard2.tiles[i]);
    // This could theoretically fail but probability is 1/25! which is essentially 0
    expect(same).toBe(false);
  });

  test("random starting team when not specified", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(generateKeyCard().startingTeam);
    }
    // Should have both teams after 20 tries
    expect(results.size).toBe(2);
  });
});
