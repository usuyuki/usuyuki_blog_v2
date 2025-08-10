// 本当は型定義ライブラリを追加すべきだが、追加すると自前で定義した型と競合して大改修必要なので保留
// @ts-ignore
import GhostContentAPI from "@tryghost/content-api";

// Ghost API オプションの型定義
interface GhostPostOptions {
	slug?: string;
	id?: string;
	filter?: string;
	limit?: number | "all";
	order?: string;
	include?: string;
	fields?: string;
}

interface GhostTagOptions {
	slug?: string;
	id?: string;
	filter?: string;
	limit?: number | "all";
	order?: string;
	include?: string;
	fields?: string;
}

// Create API instance with site credentials
export const ghostClient = new GhostContentAPI({
	url: import.meta.env.GHOST_API_URL || process.env.GHOST_API_URL,
	key: import.meta.env.GHOST_CONTENT_KEY || process.env.GHOST_CONTENT_KEY,
	version: "v5.0",
});

// キャッシュ用のシンプルなメモリストア
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCacheKey(method: string, options: unknown): string {
	return `${method}-${JSON.stringify(options)}`;
}

function getFromCache<T>(key: string): T | null {
	const cached = cache.get(key);
	if (cached && cached.expiry > Date.now()) {
		console.log(`[Cache HIT] Key: ghost:${key}`);
		return cached.data as T;
	}
	if (cached) {
		cache.delete(key); // 期限切れのキャッシュを削除
		console.log(`[Cache EXPIRED] Key: ghost:${key}`);
	} else {
		console.log(`[Cache MISS] Key: ghost:${key}`);
	}
	return null;
}

function setCache<T>(key: string, data: T, ttlMs = 60000): void {
	cache.set(key, {
		data,
		expiry: Date.now() + ttlMs,
	});
	console.log(`[Cache SET] Key: ghost:${key}, TTL: ${ttlMs}ms`);
}

// 長期キャッシュ（1週間）
function setLongTermCache<T>(key: string, data: T): void {
	const longTermKey = `longterm_${key}`;
	cache.set(longTermKey, {
		data,
		expiry: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1週間
	});
	console.log(`[Cache SET] Key: ghost:${longTermKey}, TTL: 604800000ms`);
}

function getLongTermCache<T>(key: string): T | null {
	const longTermKey = `longterm_${key}`;
	const cached = cache.get(longTermKey);
	if (cached) {
		console.log(`[Cache HIT] Key: ghost:${longTermKey} (long-term)`);
		return cached.data as T;
	}
	console.log(`[Cache MISS] Key: ghost:${longTermKey} (long-term)`);
	return null;
}

// エラーの型チェック関数
function isRateLimitError(error: unknown): boolean {
	const err = error as { type?: string; response?: { status?: number } };
	return err?.type === "TooManyRequestsError" || err?.response?.status === 429;
}

// リトライ機能付きのGhost APIクライアント
export const ghostApiWithRetry = {
	posts: {
		read: async (options: GhostPostOptions, maxRetries = 3) => {
			for (let i = 0; i < maxRetries; i++) {
				try {
					const result = await ghostClient.posts.read(options);
					return result;
				} catch (error) {
					console.error(
						`Ghost API error (attempt ${i + 1}/${maxRetries}):`,
						error,
					);
					if (i === maxRetries - 1) {
						return null;
					}
					// レート制限エラーの場合はさらに長めに待機
					const waitTime = isRateLimitError(error)
						? 5000 * (i + 1) // 5秒、10秒、15秒
						: 1000 * (i + 1); // 1秒、2秒、3秒
					console.log(`Waiting ${waitTime}ms before retry...`);
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
		browse: async (options: GhostPostOptions, maxRetries = 3) => {
			// 通常キャッシュをチェック
			const cacheKey = getCacheKey("posts.browse", options);
			const cached = getFromCache(cacheKey);
			if (cached) {
				return cached;
			}

			// 長期キャッシュもチェック
			const longTermCached = getLongTermCache(cacheKey);

			for (let i = 0; i < maxRetries; i++) {
				try {
					const result = await ghostClient.posts.browse(options);
					// 成功時に通常と長期両方のキャッシュに保存
					setCache(cacheKey, result, 3600000); // 1時間キャッシュ
					setLongTermCache(cacheKey, result); // 1週間キャッシュ
					console.log(
						`Ghost API success: fetched ${result?.length || 0} posts`,
					);
					return result;
				} catch (error) {
					console.warn(
						`Ghost API error (attempt ${i + 1}/${maxRetries}):`,
						(error as Error).message,
					);

					// レート制限エラーの場合
					if (isRateLimitError(error)) {
						console.warn("Rate limit detected");
						if (i === maxRetries - 1) {
							// 最後のリトライ失敗時は長期キャッシュを返す
							if (longTermCached) {
								console.warn("Rate limit: Returning long-term cached data");
								return longTermCached;
							} else {
								console.warn("Rate limit: No cached data available");
								return null;
							}
						}
					}

					if (i === maxRetries - 1) {
						// 最後のリトライ失敗時は長期キャッシュを返す
						if (longTermCached) {
							console.warn(
								"All retries exhausted: Returning long-term cached data",
							);
							return longTermCached;
						}
						return null;
					}

					// 待機時間を短くする（テスト環境では長すぎる）
					const waitTime = isRateLimitError(error)
						? 2000 * (i + 1) // 2秒、4秒、6秒
						: 1000 * (i + 1); // 1秒、2秒、3秒
					console.log(`Waiting ${waitTime}ms before retry...`);
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
	},
	tags: {
		read: async (options: GhostTagOptions, maxRetries = 3) => {
			for (let i = 0; i < maxRetries; i++) {
				try {
					const result = await ghostClient.tags.read(options);
					return result;
				} catch (error) {
					console.error(
						`Ghost API error (attempt ${i + 1}/${maxRetries}):`,
						error,
					);
					if (i === maxRetries - 1) {
						return null;
					}
					// レート制限エラーの場合はさらに長めに待機
					const waitTime = isRateLimitError(error)
						? 5000 * (i + 1) // 5秒、10秒、15秒
						: 1000 * (i + 1); // 1秒、2秒、3秒
					console.log(`Waiting ${waitTime}ms before retry...`);
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
		browse: async (options: GhostTagOptions, maxRetries = 3) => {
			// キャッシュをチェック
			const cacheKey = getCacheKey("tags.browse", options);
			const cached = getFromCache(cacheKey);
			if (cached) {
				return cached;
			}

			for (let i = 0; i < maxRetries; i++) {
				try {
					const result = await ghostClient.tags.browse(options);
					// 成功時にキャッシュに保存
					setCache(cacheKey, result, 3600000); // 1時間キャッシュ（レート制限対策）
					return result;
				} catch (error) {
					console.error(
						`Ghost API error (attempt ${i + 1}/${maxRetries}):`,
						error,
					);
					if (i === maxRetries - 1) {
						return null;
					}
					// レート制限エラーの場合はさらに長めに待機
					const waitTime = isRateLimitError(error)
						? 5000 * (i + 1) // 5秒、10秒、15秒
						: 1000 * (i + 1); // 1秒、2秒、3秒
					console.log(`Waiting ${waitTime}ms before retry...`);
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
	},
};
