export function sanitizeSesTagValue(input: string, fallback = "unknown") {
  const normalized = input
    .trim()
    .replace(/[^A-Za-z0-9_.@-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, 256);
}
