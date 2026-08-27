const { test, expect } = require('@playwright/test');
const { uniqueRoom, boardState, clickSquare, createRoom, joinRoom, playMoves } = require('./helpers');

const readState = (page) => page.evaluate(() => {
  const t = document.body.innerText;
  return {
    inGame: t.includes('you are'),
    waiting: t.includes('waiting for an opponent'),
    room: new URLSearchParams(window.location.search).get('room'),
  };
});

test('five simultaneous random matches pair cleanly (no stuck or overfull rooms)', async ({ browser }) => {
  const ctxs = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));
  await Promise.all(pages.map((p) => p.goto('/')));
  await Promise.all(pages.map((p) => p.waitForTimeout(1500)));
  await Promise.all(pages.map((p) => p.click('text=random match')));
  await Promise.all(pages.map((p) => p.waitForFunction(() =>
    document.body.innerText.includes('you are') || document.body.innerText.includes('waiting for an opponent'),
    null, { timeout: 30000 })));
  await pages[0].waitForTimeout(2500);

  const states = await Promise.all(pages.map(readState));
  const inGame = states.filter((s) => s.inGame).length;
  const waiting = states.filter((s) => s.waiting).length;
  const rooms = {};
  states.forEach((s) => { rooms[s.room] = (rooms[s.room] || 0) + 1; });
  expect(inGame).toBe(4);
  expect(waiting).toBe(1);
  expect(Math.max(...Object.values(rooms))).toBeLessThanOrEqual(2);

  await Promise.all(ctxs.map((c) => c.close()));
});

test('mid-game refresh resumes the same game without a forfeit', async ({ browser }) => {
  const room = uniqueRoom('refresh');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await createRoom(a, room);
  await joinRoom(b, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });
  await playMoves([[a, 4], [b, 0]]);

  await b.reload();
  await b.waitForSelector('text=you are', { timeout: 20000 });
  await a.waitForTimeout(3000);

  // Same room for both, no forfeit flash for A, and the board is preserved
  expect((await readState(a)).room).toBe(room);
  expect((await readState(b)).room).toBe(room);
  expect(await a.locator('text=you win, opponent left').count()).toBe(0);
  await expect.poll(async () => (await boardState(b))[4]).toBe('X');
  await expect.poll(async () => (await boardState(b))[0]).toBe('O');

  // And still playable
  await playMoves([[a, 2]]);
  await expect.poll(async () => (await boardState(b))[2]).toBe('X');

  await ctxA.close();
  await ctxB.close();
});

test('a duplicated tab (cloned sessionStorage identity) gets its own seat', async ({ browser }) => {
  const room = uniqueRoom('dupid');
  const ctx = await browser.newContext();
  // Both pages carry the same per-tab identity, as tab duplication does
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('ttt_username', 'dup-identity-e2e'); } catch (err) {}
  });
  const p1 = await ctx.newPage();
  const p2 = await ctx.newPage();

  await createRoom(p1, room);
  await joinRoom(p2, room);
  await p1.waitForSelector('text=you are', { timeout: 15000 });

  // The server must have renamed one tab so they hold distinct seats
  const symbol = (p) => p.evaluate(() => (document.body.innerText.match(/you are\s*(X|O)/) || [])[1] || null);
  const s1 = await symbol(p1);
  const s2 = await symbol(p2);
  expect([s1, s2].sort()).toEqual(['O', 'X']);

  // And they can actually play each other
  const xPage = s1 === 'X' ? p1 : p2;
  const oPage = s1 === 'X' ? p2 : p1;
  await playMoves([[xPage, 4]]);
  await expect.poll(async () => (await boardState(oPage))[4]).toBe('X');

  await ctx.close();
});

test('waiting-screen refresh keeps the room and its invite link alive', async ({ browser }) => {
  const room = uniqueRoom('waitref');
  const ctx = await browser.newContext();
  const p = await ctx.newPage();

  await createRoom(p, room);
  await p.reload();
  await p.waitForSelector('text=invite a friend', { timeout: 20000 });
  expect((await readState(p)).room).toBe(room);

  // The already-shared invite link must still land in this room
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await joinRoom(p2, room);
  expect((await readState(p2)).room).toBe(room);
  await p.waitForSelector('text=you are', { timeout: 15000 });

  await ctx.close();
  await ctx2.close();
});

test('post-game refresh restores the finished screen with rematch and share controls', async ({ browser }) => {
  const room = uniqueRoom('postwin');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await createRoom(a, room);
  await joinRoom(b, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });
  await playMoves([[a, 0], [b, 1], [a, 3], [b, 4], [a, 6]]);
  await a.waitForSelector('text=you win', { timeout: 10000 });

  // The winner refreshes: the reconnect must land back on the finished
  // board with the result, rematch and share controls intact
  await a.reload();
  await a.waitForSelector('text=you win', { timeout: 20000 });
  await a.waitForSelector('text=new match', { timeout: 5000 });
  await a.waitForSelector('text=share on x', { timeout: 5000 });

  // And no forfeit was handed out to the opponent
  expect(await b.locator('text=you win, opponent left').count()).toBe(0);

  // Rematch still works after the refresh
  await a.click('text=new match');
  await expect.poll(async () => (await boardState(b)).join('')).toBe('');

  await ctxA.close();
  await ctxB.close();
});
