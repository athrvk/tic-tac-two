// Sharing utilities: native share sheet on mobile, clipboard fallback on desktop

export const buildInviteLink = (roomId) =>
  `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;

// Room codes never contain whitespace. Some share targets concatenate the
// share text and URL into one string, so anything after whitespace (encoded
// or not) in the ?room= value is garbage from a mangled share — drop it.
export const sanitizeRoomCode = (raw) => {
  if (!raw) return '';
  return raw.trim().split(/\s/)[0];
};

// Invites share the bare link only — the Open Graph card carries the pitch,
// and a bare URL can't be mangled by share targets that merge text and url.
export const shareLink = async (url) => {
  if (navigator.share) {
    try {
      await navigator.share({ url });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return 'dismissed';
      }
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (err) {
    return 'failed';
  }
};

export const shareOrCopy = async ({ title, text, url }) => {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return 'dismissed';
      }
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch (err) {
    return 'failed';
  }
};
