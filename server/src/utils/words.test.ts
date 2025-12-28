import { test, expect, describe } from "bun:test";
import { WORD_BANK, getRandomWords } from "./words.ts";

describe("WORD_BANK", () => {
  test("has at least 400 words", () => {
    expect(WORD_BANK.length).toBeGreaterThanOrEqual(400);
  });

  test("all words are uppercase", () => {
    for (const word of WORD_BANK) {
      expect(word).toBe(word.toUpperCase());
    }
  });

  test("no duplicate words", () => {
    const unique = new Set(WORD_BANK);
    expect(unique.size).toBe(WORD_BANK.length);
  });

  test("all words contain only letters", () => {
    for (const word of WORD_BANK) {
      expect(word).toMatch(/^[A-Z]+$/);
    }
  });
});

describe("getRandomWords", () => {
  test("returns requested number of words", () => {
    const words = getRandomWords(25);
    expect(words.length).toBe(25);
  });

  test("returns unique words", () => {
    const words = getRandomWords(25);
    const unique = new Set(words);
    expect(unique.size).toBe(25);
  });

  test("returns different words each time", () => {
    const words1 = getRandomWords(25);
    const words2 = getRandomWords(25);
    const same = words1.every((w, i) => w === words2[i]);
    expect(same).toBe(false);
  });

  test("all returned words are from word bank", () => {
    const words = getRandomWords(25);
    for (const word of words) {
      expect(WORD_BANK).toContain(word);
    }
  });
});
