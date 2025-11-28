/**
 * Performance measurement utilities.
 */

export async function measureLatency<T>(
  fn: () => Promise<T>
): Promise<{ result: T; elapsedMs: number }> {
  const start = performance.now();
  const result = await fn();
  const elapsedMs = Math.round(performance.now() - start);
  return { result, elapsedMs };
}
