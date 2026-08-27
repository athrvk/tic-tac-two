// Shared helpers for tic-tac-two e2e tests.

// Unique room code per call so parallel/retried tests never collide,
// and never matchable by another test's random-match.
const uniqueRoom = (label) =>
  `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// The 9 board squares are the only buttons whose text is '', 'X' or 'O'.
const boardState = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => ['', 'X', 'O'].includes(b.textContent.trim()))
      .map((b) => b.textContent.trim())
  );

const clickSquare = (page, index) =>
  page.evaluate((i) => {
    const squares = Array.from(document.querySelectorAll('button')).filter((b) =>
      ['', 'X', 'O'].includes(b.textContent.trim())
    );
    squares[i].click();
  }, index);

// Creates a room via the home screen and waits for the waiting screen.
const createRoom = async (page, roomCode) => {
  await page.goto('/');
  await page.fill('input[type="text"]', roomCode);
  await page.click('text=new game');
  await page.waitForSelector('text=invite a friend', { timeout: 15000 });
};

// Joins a room through an invite link and waits for the game screen.
const joinRoom = async (page, roomCode) => {
  await page.goto(`/?room=${roomCode}`);
  await page.waitForSelector('text=you are', { timeout: 20000 });
};

// Plays alternating moves; each entry is [page, squareIndex].
const playMoves = async (moves, settleMs = 400) => {
  for (const [page, index] of moves) {
    await clickSquare(page, index);
    await page.waitForTimeout(settleMs);
  }
};

module.exports = { uniqueRoom, boardState, clickSquare, createRoom, joinRoom, playMoves };
