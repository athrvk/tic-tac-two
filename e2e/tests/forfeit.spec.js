const { test, expect } = require('@playwright/test');
const { uniqueRoom, boardState, createRoom, joinRoom, playMoves } = require('./helpers');

test('leaving a live game hands the remaining player a forfeit win, and the room stays usable', async ({ browser }) => {
  const room = uniqueRoom('forfeit');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxC = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const c = await ctxC.newPage();

  await createRoom(a, room);
  await joinRoom(b, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });
  await playMoves([[a, 4], [b, 0], [a, 2]]);

  // B abandons mid-game (tab closed)
  await ctxB.close();

  // A is notified, declared winner by forfeit, and stays in the room
  await a.waitForSelector('text=you win — opponent left', { timeout: 20000 });
  await a.waitForSelector('text=invite a friend', { timeout: 5000 });

  // The room is still joinable and the next game starts on a clean board
  await joinRoom(c, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });
  await expect.poll(async () => (await boardState(a)).join('')).toBe('');

  await ctxA.close();
  await ctxC.close();
});

test('leaving after the game already ended shows a plain notice, not a forfeit win', async ({ browser }) => {
  const room = uniqueRoom('postgame');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await createRoom(a, room);
  await joinRoom(b, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });

  // X wins the top row, then the loser leaves
  await playMoves([[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]]);
  await a.waitForSelector('text=you win', { timeout: 10000 });
  await ctxB.close();

  await a.waitForSelector('text=opponent left the room', { timeout: 20000 });
  expect(await a.locator('text=you win — opponent left').count()).toBe(0);

  await ctxA.close();
});
