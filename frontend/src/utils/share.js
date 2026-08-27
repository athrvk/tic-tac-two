// Sharing utilities: native share sheet on mobile, clipboard fallback on desktop

export const buildInviteLink = (roomId) =>
  `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;

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
