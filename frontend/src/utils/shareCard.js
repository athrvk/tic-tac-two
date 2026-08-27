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

const drawBoard = (ctx, squares, winningLine, cx, top, boardSize) => {
  const gap = boardSize * 0.035;
  const cell = (boardSize - 2 * gap) / 3;
  const left = cx - boardSize / 2;
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = left + col * (cell + gap);
    const y = top + row * (cell + gap);
    const isWin = winningLine && winningLine.includes(i);
    ctx.fillStyle = isWin ? INK : SURFACE;
    ctx.strokeStyle = isWin ? INK : BORDER;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, cell, cell, cell * 0.12);
    ctx.fill();
    ctx.stroke();
    const value = squares[i];
    if (value) {
      ctx.fillStyle = isWin ? PAPER : value === 'X' ? X_INK : O_INK;
      ctx.font = `${value === 'X' ? 'italic ' : ''}bold ${cell * 0.55}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(value, x + cell / 2, y + cell / 2 + cell * 0.03);
    }
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
    ctx.font = 'bold 64px Georgia, serif';
    const w1 = ctx.measureText('tic tac ').width;
    ctx.font = 'italic bold 64px Georgia, serif';
    const w2 = ctx.measureText('two').width;
    const mastLeft = (SIZE - w1 - w2) / 2;
    ctx.fillStyle = INK;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('tic tac ', mastLeft, 158);
    ctx.fillStyle = X_INK;
    ctx.font = 'italic bold 64px Georgia, serif';
    ctx.fillText('two', mastLeft + w1, 158);
    ctx.textAlign = 'center';

    // Headline
    ctx.fillStyle = INK;
    ctx.font = 'italic 500 78px Georgia, serif';
    ctx.fillText(result === 'win' ? 'i won this one' : 'beat me if you can', SIZE / 2, 268);

    drawBoard(ctx, squares, winningLine, SIZE / 2, 330, 470);

    // Stats pill row
    const parts = [];
    if (stats.durationMs) parts.push(`won in ${formatDuration(stats.durationMs)}`);
    if (stats.moves) parts.push(`${stats.moves} moves`);
    if (stats.streak > 1) parts.push(`${stats.streak} win streak`);
    if (result !== 'win' && parts.length) parts[0] = parts[0].replace('won in', 'played for');
    const statsText = parts.join('   ·   ');
    if (statsText) {
      ctx.font = '42px Georgia, serif';
      const w = ctx.measureText(statsText).width + 96;
      ctx.fillStyle = INK;
      roundRect(ctx, (SIZE - w) / 2, 840, w, 84, 42);
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.fillText(statsText, SIZE / 2, 896);
    }

    // Tagline + URL
    ctx.fillStyle = MUTED;
    ctx.font = 'italic 34px Georgia, serif';
    ctx.fillText('tic-tac-toe where moves vanish', SIZE / 2, 956);
    ctx.fillStyle = INK;
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(window.location.host, SIZE / 2, SIZE - 76);

    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });

/**
 * Shares the card image via the native share sheet when the platform can
 * share files (phones: X/Instagram/WhatsApp/FB all accept it); otherwise
 * downloads the PNG so it can be posted manually.
 * Returns 'shared' | 'downloaded' | 'dismissed' | 'failed'.
 */
export const shareCardImage = async (blob, { text, url }) => {
  const file = new File([blob], 'tic-tac-two-victory.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return 'dismissed';
      }
      // fall through to download
    }
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
