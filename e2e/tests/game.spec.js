const { test, expect } = require('@playwright/test');
const { uniqueRoom, boardState, createRoom, joinRoom, playMoves } = require('./helpers');

test('invite link joins the room, even when the share text got merged into the URL', async ({ browser }) => {
  const room = uniqueRoom('invite');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await createRoom(a, room);
  // The address bar itself is the invite link
  await expect(a).toHaveURL(new RegExp(`room=${room}`));

  // Some share targets append the share text to the URL — the room code must
  // still be recovered from a mangled link
  await b.goto(`/?room=${room}%20play%20tic-tac-two%20with%20me%20%E2%80%94%20join%20my%20room:`);
  await b.waitForSelector('text=you are', { timeout: 20000 });
  await a.waitForSelector('text=you are', { timeout: 15000 });

  await ctxA.close();
  await ctxB.close();
});

test('vanish rule: the oldest mark disappears on the 7th move, with no advance hint', async ({ browser }) => {
  const room = uniqueRoom('vanish');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await createRoom(a, room);
  await joinRoom(b, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });

  // Six non-winning moves: X 0,1,5 / O 4,2,3
  await playMoves([[a, 0], [b, 4], [a, 1], [b, 2], [a, 5], [b, 3]]);

  // The mechanic stays hidden: no square carries a vanish tooltip
  expect(await a.locator('button[title]').count()).toBe(0);
  expect((await boardState(a))[0]).toBe('X');

  // The 7th move erases the oldest mark (X at 0)
  await playMoves([[a, 8]]);
  await expect.poll(async () => (await boardState(a))[0]).toBe('');
  await expect.poll(async () => (await boardState(b))[0]).toBe('');

  await ctxA.close();
  await ctxB.close();
});

test('win shows the filled line and share buttons for both players', async ({ browser }) => {
  const room = uniqueRoom('win');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await createRoom(a, room);
  await joinRoom(b, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });

  // X (creator) wins the top row in 5 moves
  await playMoves([[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]]);

  await a.waitForSelector('text=you win', { timeout: 10000 });
  await b.waitForSelector('text=you lose', { timeout: 10000 });
  await a.waitForSelector('text=brag about it', { timeout: 5000 });
  await b.waitForSelector('text=share game', { timeout: 5000 });

  await ctxA.close();
  await ctxB.close();
});
