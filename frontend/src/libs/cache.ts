interface CacheItem<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

class MemoryCache {
	private cache = new Map<string, CacheItem<unknown>>();

	set<T>(key: string, data: T, ttlMs: number): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl: ttlMs,
		});
		console.log(`[Cache SET] Key: ${key}, TTL: ${ttlMs}ms`);
	}

	get<T>(key: string): T | null {
		const item = this.cache.get(key);
		if (!item) {
			console.log(`[Cache MISS] Key: ${key}`);
			return null;
		}

		const now = Date.now();
		if (now - item.timestamp > item.ttl) {
			this.cache.delete(key);
			console.log(`[Cache EXPIRED] Key: ${key}`);
			return null;
		}

		console.log(`[Cache HIT] Key: ${key}`);
		return item.data as T;
	}

	clear(): void {
		this.cache.clear();
	}

	delete(key: string): boolean {
		return this.cache.delete(key);
	}

	// キャッシュサイズを制限するためのヘルパー
	cleanup(): void {
		const now = Date.now();
		for (const [key, item] of this.cache.entries()) {
			if (now - item.timestamp > item.ttl) {
				this.cache.delete(key);
			}
		}
	}
}

export const cache = new MemoryCache();

// 1時間のTTL（ミリ秒）
export const ONE_HOUR_MS = 60 * 60 * 1000;
