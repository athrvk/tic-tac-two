// Renders a shareable victory/challenge card as a PNG (canvas, no backend).
// 1080x1080 square: the one size that works across X, Instagram, FB, WhatsApp.

const PAPER = '#f7f5f0';
const INK = '#141414';
const MUTED = '#6f6a60';
const BORDER = '#d9d4c9';
const SURFACE = '#ffffff';
const X_INK = '#b3372a';
const O_INK = '#1f5f8b';

const SIZE = 1080;

export const formatDuration = (ms) => {
  const total = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawBoard = (ctx, squares, winningLine, cx, cy, boardSize, tiltRad) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tiltRad);
  const gap = boardSize * 0.04;
  const cell = (boardSize - 2 * gap) / 3;
  const origin = -boardSize / 2;
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = origin + col * (cell + gap);
    const y = origin + row * (cell + gap);
    const isWin = winningLine && winningLine.includes(i);
    ctx.save();
    ctx.shadowColor = 'rgba(20, 20, 20, 0.14)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = isWin ? INK : SURFACE;
    roundRect(ctx, x, y, cell, cell, cell * 0.14);
    ctx.fill();
    ctx.restore();
    if (!isWin) {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cell, cell, cell * 0.14);
      ctx.stroke();
    }
    const value = squares[i];
    if (value) {
      ctx.fillStyle = isWin ? PAPER : value === 'X' ? X_INK : O_INK;
      ctx.font = `${value === 'X' ? 'italic ' : ''}bold ${cell * 0.58}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(value, x + cell / 2, y + cell / 2 + cell * 0.03);
    }
  }
  ctx.restore();
};

// Deterministic celebratory sprinkle around the board (positions hand-placed
// to frame the composition, never behind text)
const CONFETTI_SPECKS = [
  [128, 402, 16, X_INK, 0.5], [948, 372, 14, O_INK, -0.4], [176, 660, 12, INK, 0.2],
  [918, 640, 18, X_INK, 0.9], [110, 528, 10, O_INK, 0], [962, 508, 10, INK, -0.7],
  [206, 356, 10, O_INK, 0.6], [886, 742, 12, INK, 0.3], [150, 760, 14, O_INK, -0.5],
  [930, 260, 12, X_INK, 0.1],
];

const drawConfetti = (ctx) => {
  for (const [x, y, size, color, rot] of CONFETTI_SPECKS) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
};

/**
 * Draws the card and returns a PNG Blob.
 * result: 'win' | 'lose'; stats: { durationMs, moves, streak }
 */
export const renderShareCard = ({ result, squares, winningLine, stats }) =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Editorial double rule, top and bottom
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    for (const y of [56, 66, SIZE - 66, SIZE - 56]) {
      ctx.beginPath();
      ctx.moveTo(72, y);
      ctx.lineTo(SIZE - 72, y);
      ctx.stroke();
    }

    // Masthead: measure both halves so the combined title is truly centered
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = 'bold 52px Georgia, serif';
    const w1 = ctx.measureText('tic tac ').width;
    ctx.font = 'italic bold 52px Georgia, serif';
    const w2 = ctx.measureText('two').width;
    const mastLeft = (SIZE - w1 - w2) / 2;
    ctx.fillStyle = INK;
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText('tic tac ', mastLeft, 142);
    ctx.fillStyle = X_INK;
    ctx.font = 'italic bold 52px Georgia, serif';
    ctx.fillText('two', mastLeft + w1, 142);
    ctx.textAlign = 'center';

    // Headline: the poster moment. Winner gets a short punch with a red-ink
    // full stop; loser gets the challenge line.
    if (result === 'win') {
      ctx.font = 'italic bold 150px Georgia, serif';
      const hw = ctx.measureText('i won').width;
      const dw = ctx.measureText('.').width;
      const hx = (SIZE - hw - dw) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.fillText('i won', hx, 310);
      ctx.fillStyle = X_INK;
      ctx.fillText('.', hx + hw, 310);
      ctx.textAlign = 'center';
    } else {
      ctx.fillStyle = INK;
      ctx.font = 'italic bold 92px Georgia, serif';
      ctx.fillText('beat me if you can', SIZE / 2, 296);
    }

    if (result === 'win') {
      drawConfetti(ctx);
    }
    drawBoard(ctx, squares, winningLine, SIZE / 2, 570, 460, -0.035);

    // Stats pill
    const parts = [];
    if (stats.durationMs) parts.push(`${result === 'win' ? 'won in' : 'played for'} ${formatDuration(stats.durationMs)}`);
    if (stats.moves) parts.push(`${stats.moves} moves`);
    if (stats.streak > 1) parts.push(`${stats.streak} win streak`);
    const statsText = parts.join('  ·  ');
    if (statsText) {
      ctx.font = 'bold 40px Georgia, serif';
      const w = ctx.measureText(statsText).width + 104;
      ctx.fillStyle = INK;
      roundRect(ctx, (SIZE - w) / 2, 856, w, 86, 43);
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.fillText(statsText, SIZE / 2, 912);
    }

    // One-line footer: bold URL, muted tagline, measured as a unit
    const urlText = window.location.host;
    const tagText = '  ·  tic-tac-toe where moves vanish';
    ctx.textAlign = 'left';
    ctx.font = 'bold 32px Georgia, serif';
    const uw = ctx.measureText(urlText).width;
    ctx.font = 'italic 32px Georgia, serif';
    const tw = ctx.measureText(tagText).width;
    const fx = (SIZE - uw - tw) / 2;
    ctx.fillStyle = INK;
    ctx.font = 'bold 32px Georgia, serif';
    ctx.fillText(urlText, fx, SIZE - 92);
    ctx.fillStyle = MUTED;
    ctx.font = 'italic 32px Georgia, serif';
    ctx.fillText(tagText, fx + uw, SIZE - 92);
    ctx.textAlign = 'center';

    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });

/**
 * Shares the card image via the native share sheet when the platform can
 * share files (phones: X/Instagram/WhatsApp/FB all accept it); otherwise
 * downloads the PNG so it can be posted manually.
 * Returns 'shared' | 'downloaded' | 'dismissed' | 'failed'.
 */
// Share intents (window.open to a twitter.com/x.com/etc URL) can't attach
// media, but the X web composer accepts an image pasted from the clipboard,
// so this lets the caller copy the card there for a one-paste attach.
export const copyCardToClipboard = async (blob) => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch (err) {
    return false;
  }
};

// fallback: 'download' (default, used by the share-card button) saves the
// PNG locally when navigator.share is unavailable or throws a non-abort
// error; 'none' (used by the share chips) skips that and just reports
// 'failed', so the caller can fall back to opening the channel's intent URL
// instead of silently starting a download the user didn't ask for.
export const shareCardImage = async (blob, { text, url, fallback = 'download' }) => {
  const file = new File([blob], 'tic-tac-two-victory.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return 'dismissed';
      }
      // fall through to download (or report failed, per `fallback`)
    }
  }
  if (fallback === 'none') {
    return 'failed';
  }
  try {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tic-tac-two-victory.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    return 'downloaded';
  } catch (err) {
    return 'failed';
  }
};
