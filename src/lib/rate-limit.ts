/**
 * Rate limiter em memória (sliding window), keyed por string (ex.: IP ou
 * "IP:email"). Best-effort: o estado vive no processo Node e reseta em cold
 * start serverless — suficiente para mitigar abuso no cadastro; se virar
 * problema real, migrar para Upstash Redis.
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return function check(key: string): boolean {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (arr.length >= opts.max) {
      hits.set(key, arr);
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
    return true;
  };
}
