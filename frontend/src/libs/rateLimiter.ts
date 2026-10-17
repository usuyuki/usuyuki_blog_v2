// 期限切れキーの掃除を行う保持キー数の既定値(これを超えたときだけ全走査する)
const DEFAULT_MAX_KEYS = 10_000;

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface FixedWindowRateLimiter {
  // keyのリクエストを1回分記録し、上限内ならtrue、上限超過ならfalseを返す
  tryConsume(key: string): boolean;
  // 現在保持しているキー数(テスト・監視用)
  size(): number;
}

// 固定ウィンドウ方式の簡易レートリミッターを生成する。
// カウントはインメモリでコンテナ単位のため、コンテナ再起動でリセットされる。
// 保持キー数がmaxKeysを超えたら期限切れのキーを掃除し、メモリが際限なく増えるのを防ぐ。
export function createFixedWindowRateLimiter({
  limit,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}): FixedWindowRateLimiter {
  const windows = new Map<string, RateLimitWindow>();

  function pruneExpired(current: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= current) windows.delete(key);
    }
  }

  return {
    tryConsume(key: string): boolean {
      const current = now();
      if (windows.size >= maxKeys) pruneExpired(current);

      const window = windows.get(key);
      if (!window || window.resetAt <= current) {
        windows.set(key, { count: 1, resetAt: current + windowMs });
        return true;
      }
      if (window.count >= limit) return false;
      window.count += 1;
      return true;
    },
    size(): number {
      return windows.size;
    },
  };
}
