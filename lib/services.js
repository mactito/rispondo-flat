// Services are stored as [{name, duration}] but older rows (from /api/signup) hold plain strings.
// Always go through this so the prompt never says "undefined, undefined".
export function normalizeServices(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((s) =>
      typeof s === 'string'
        ? { name: s.trim(), duration: 30 }
        : { name: String(s?.name || '').trim(), duration: Number(s?.duration) || 30 }
    )
    .filter((s) => s.name);
}
