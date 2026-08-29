export const startLogin = (next?: string) => {
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : "";
  window.location.assign(`/login${safeNext}`);
};
