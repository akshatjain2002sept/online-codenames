import { test } from "@playwright/test";

test.describe("Codenames E2E", () => {
  test.skip("TODO: enable once UI and routes are finalized", async ({ page }) => {
    // Create room -> join -> start game
    await page.goto("/");
    // TODO: click "Create Room"
    // TODO: capture room code
    // TODO: open second page and join with room code
    // TODO: assign teams/roles and start game
  });

  test.skip("TODO: enable full game to victory", async ({ page }) => {
    // TODO: play through full game until a team wins
  });

  test.skip("TODO: enable assassin loss flow", async ({ page }) => {
    // TODO: reveal assassin and assert game over state
  });

  test.skip("TODO: enable reconnection mid-game", async ({ page, context }) => {
    // TODO: disconnect a player, reconnect, and verify state sync
    await page.goto("/");
    await context.clearCookies();
  });
});
