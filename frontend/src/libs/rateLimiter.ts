// 保持キー数の既定の上限(これを超える新規キーは拒否する)
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
// 保持キー数はmaxKeysを上限とし、上限に達している間は新しいキーを拒否する(既存キーは通常どおり判定)。
// 古いキーを追い出す方式だと、大量のキーを送り付けるだけで他のキーのカウントをリセットできてしまうため採らない。
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
  // ウィンドウを作り直すときは一度deleteしてから入れ直すため、Mapの挿入順=resetAtの昇順になる
  const windows = new Map<string, RateLimitWindow>();

  // 先頭(=最も早く期限切れになるキー)から期限切れのものだけを取り除く。
  // 期限内のキーに当たった時点で打ち切るので、1回あたりの処理は削除した件数分で済む
  function pruneExpired(current: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt > current) break;
      windows.delete(key);
    }
  }

  return {
    tryConsume(key: string): boolean {
      const current = now();
      pruneExpired(current);

      const window = windows.get(key);
      if (window) {
        if (window.count >= limit) return false;
        window.count += 1;
        return true;
      }
      if (windows.size >= maxKeys) return false;
      windows.set(key, { count: 1, resetAt: current + windowMs });
      return true;
    },
    size(): number {
      return windows.size;
    },
  };
}
