const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_CONCURRENT_PER_SERVICE = 4;

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const activeByService = new Map<string, number>();

export function assertInvocationRate(wallet: string) {
  const key = wallet.toLowerCase();
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) throw new Error("Invocation rate limit exceeded; retry shortly");
  current.count += 1;
}

export function acquireServiceSlot(serviceId: string) {
  const active = activeByService.get(serviceId) ?? 0;
  if (active >= MAX_CONCURRENT_PER_SERVICE) throw new Error("Service is at capacity; retry shortly");
  activeByService.set(serviceId, active + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (activeByService.get(serviceId) ?? 1) - 1;
    if (remaining > 0) activeByService.set(serviceId, remaining);
    else activeByService.delete(serviceId);
  };
}

export function resetInvocationGuardsForTests() {
  requestWindows.clear();
  activeByService.clear();
}
