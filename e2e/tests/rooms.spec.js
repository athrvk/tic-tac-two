const { test } = require('@playwright/test');
const { uniqueRoom, createRoom, joinRoom } = require('./helpers');

test('pressing "new game" with an existing code joins the room instead of resetting it', async ({ browser }) => {
  const room = uniqueRoom('dup');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await createRoom(a, room);

  // The second friend also presses "new game" with the same code — they must
  // end up in the same room (skipping the waiting screen), and the first
  // player's seat must survive
  await b.goto('/');
  await b.fill('input[type="text"]', room);
  await b.click('text=new game');
  await b.waitForSelector('text=you are', { timeout: 15000 });
  await a.waitForSelector('text=you are', { timeout: 15000 });

  await ctxA.close();
  await ctxB.close();
});

test('a third player joining a full room is diverted to a fresh room', async ({ browser }) => {
  const room = uniqueRoom('full');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxC = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const c = await ctxC.newPage();

  await createRoom(a, room);
  await joinRoom(b, room);
  await a.waitForSelector('text=you are', { timeout: 15000 });

  // Room is full — C lands in a fresh room of their own, waiting for a player
  await c.goto(`/?room=${room}`);
  await c.waitForSelector('text=invite a friend', { timeout: 15000 });
  const cRoom = await c.evaluate(() => new URLSearchParams(window.location.search).get('room'));
  if (cRoom === room) {
    throw new Error('third player was placed into a full room');
  }

  await ctxA.close();
  await ctxB.close();
  await ctxC.close();
});
