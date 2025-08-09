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
const cache = new Map<string, { data: any; expiry: number }>();

function getCacheKey(method: string, options: any): string {
	return `${method}-${JSON.stringify(options)}`;
}

function getFromCache<T>(key: string): T | null {
	const cached = cache.get(key);
	if (cached && cached.expiry > Date.now()) {
		return cached.data;
	}
	cache.delete(key); // 期限切れのキャッシュを削除
	return null;
}

function setCache<T>(key: string, data: T, ttlMs = 60000): void {
	cache.set(key, {
		data,
		expiry: Date.now() + ttlMs,
	});
}

// エラーの型チェック関数
function isRateLimitError(error: any): boolean {
	return (
		error?.type === "TooManyRequestsError" || error?.response?.status === 429
	);
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
						? 30000 * 2 ** i
						: 3000 * 2 ** i;
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
		browse: async (options: GhostPostOptions, maxRetries = 1) => {
			// キャッシュをチェック
			const cacheKey = getCacheKey("posts.browse", options);
			const cached = getFromCache(cacheKey);
			if (cached) {
				return cached;
			}

			for (let i = 0; i < maxRetries; i++) {
				try {
					const result = await ghostClient.posts.browse(options);
					// 成功時にキャッシュに保存
					setCache(cacheKey, result, 900000); // 15分間キャッシュ（レート制限対策）
					return result;
				} catch (error) {
					console.warn(
						`Ghost API error (attempt ${i + 1}/${maxRetries}):`,
						error.message,
					);

					// レート制限エラーの場合は即座に諦める（フェールファスト）
					if (isRateLimitError(error)) {
						console.warn("Rate limit detected, skipping Ghost API calls");
						return null;
					}

					if (i === maxRetries - 1) {
						return null;
					}
					// レート制限エラーの場合はさらに長めに待機
					const waitTime = isRateLimitError(error)
						? 30000 * 2 ** i
						: 3000 * 2 ** i;
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
						? 30000 * 2 ** i
						: 3000 * 2 ** i;
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
					setCache(cacheKey, result, 900000); // 15分間キャッシュ（レート制限対策）
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
						? 30000 * 2 ** i
						: 3000 * 2 ** i;
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
	},
};
