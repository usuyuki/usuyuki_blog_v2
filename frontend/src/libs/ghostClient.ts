// 本当は型定義ライブラリを追加すべきだが、追加すると自前で定義した型と競合して大改修必要なので保留
// biome-ignore lint/suspicious/noTsIgnore: Type definitions conflict with custom types
// @ts-ignore
import GhostContentAPI from "@tryghost/content-api";
import astroLogger from "./astroLogger";
import errorHandler from "./errorHandler";
import { LOG_TYPES } from "./logTypes";
import { getGhostApiUrl, getGhostContentKey } from "./env";

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
	url: getGhostApiUrl(),
	key: getGhostContentKey(),
	version: "v5.0",
});

// キャッシュ用のシンプルなメモリストア
const cache = new Map<string, { data: object; expiry: number }>();

function getCacheKey(method: string, options: object): string {
	return `${method}-${JSON.stringify(options)}`;
}

function getFromCache<T>(key: string): T | null {
	const cached = cache.get(key);
	if (cached && cached.expiry > Date.now()) {
		astroLogger.cacheLog("HIT", key, true, { source: "ghost" });
		return cached.data as T;
	}
	if (cached) {
		cache.delete(key); // 期限切れのキャッシュを削除
		astroLogger.cacheLog("EXPIRED", key, false, { source: "ghost" });
	} else {
		astroLogger.cacheLog("MISS", key, false, { source: "ghost" });
	}
	return null;
}

function setCache(key: string, data: object, ttlMs = 60000): void {
	cache.set(key, {
		data,
		expiry: Date.now() + ttlMs,
	});
	astroLogger.cacheLog("SET", key, false, { source: "ghost", ttl: ttlMs });
}

// 長期キャッシュ（1週間）
function setLongTermCache(key: string, data: object): void {
	const longTermKey = `longterm_${key}`;
	cache.set(longTermKey, {
		data,
		expiry: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1週間
	});
	astroLogger.cacheLog("SET_LONGTERM", longTermKey, false, {
		source: "ghost",
		ttl: 604800000,
	});
}

function getLongTermCache<T>(key: string): T | null {
	const longTermKey = `longterm_${key}`;
	const cached = cache.get(longTermKey);
	if (cached) {
		astroLogger.cacheLog("HIT_LONGTERM", longTermKey, true, {
			source: "ghost",
		});
		return cached.data as T;
	}
	astroLogger.cacheLog("MISS_LONGTERM", longTermKey, false, {
		source: "ghost",
	});
	return null;
}

// エラーの型チェック関数
function isRateLimitError(error: Error): boolean {
	const err = error as { type?: string; response?: { status?: number } };
	return err?.type === "TooManyRequestsError" || err?.response?.status === 429;
}

// エラーログを簡潔に出力する関数
function logGhostError(
	error: Error,
	attempt: number,
	maxRetries: number,
	request?: Request,
): void {
	const err = error as {
		type?: string;
		context?: string;
		id?: string;
		response?: { status?: number };
	};

	// 404エラーは警告として扱う
	if (err?.response?.status === 404) {
		if (request) {
			astroLogger.requestError(
				`Ghost API 404: Resource not found`,
				request,
				error,
				{
					attempt,
					maxRetries,
					status: err?.response?.status,
					id: err?.id,
					context: err?.context,
					type: err?.type,
					service: "ghost-api",
					logType: LOG_TYPES.API,
				},
			);
		} else {
			astroLogger.warn(`Ghost API 404: Resource not found`, {
				attempt,
				maxRetries,
				status: err?.response?.status,
				id: err?.id,
				context: err?.context,
				type: err?.type,
				service: "ghost-api",
				logType: LOG_TYPES.API,
			});
		}
	} else {
		errorHandler.handleError(error as Error, {
			attempt,
			maxRetries,
			status: err?.response?.status,
			id: err?.id,
			context: err?.context,
			type: err?.type,
			service: "ghost-api",
			request,
		});
	}
}

// リトライ機能付きのGhost APIクライアント
export const ghostApiWithRetry = {
	posts: {
		read: async (
			options: GhostPostOptions,
			maxRetries = 3,
			request?: Request,
		) => {
			// slugの検証を強化
			if (
				!options.slug ||
				typeof options.slug !== "string" ||
				options.slug.trim() === "" ||
				options.slug === "undefined" ||
				options.slug.includes("undefined")
			) {
				astroLogger.warn("Invalid slug provided to Ghost API", {
					slug: options.slug,
					slugType: typeof options.slug,
					service: "ghost-api",
					logType: LOG_TYPES.API,
				});
				return null;
			}

			for (let i = 0; i < maxRetries; i++) {
				try {
					const { slug, ...cleanOptions } = options;
					if (slug) {
						const browseOptions = {
							filter: `slug:${encodeURIComponent(`'${slug}'`)}`,
							limit: 1,
							...cleanOptions,
						};
						const browseResult = await ghostClient.posts.browse(browseOptions);
						const result = browseResult?.[0] || null;
						return result;
					} else {
						const result = await ghostClient.posts.read(cleanOptions);
						return result;
					}
				} catch (error) {
					const err = error as Error;
					logGhostError(err, i + 1, maxRetries, request);

					// レート制限エラー以外（404含む）はリトライしない
					if (!isRateLimitError(err)) {
						return null;
					}

					if (i === maxRetries - 1) {
						return null;
					}
					// レート制限エラーの場合の待機時間
					const waitTime = 5000 * (i + 1); // 5秒、10秒、15秒
					astroLogger.info(`Waiting ${waitTime}ms before retry...`, {
						logType: LOG_TYPES.API,
						waitTime,
						attempt: i + 1,
						service: "ghost-api",
					});
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
		browse: async (
			options: GhostPostOptions,
			maxRetries = 3,
			request?: Request,
		) => {
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
					astroLogger.info(
						`Ghost API success: fetched ${result?.length || 0} posts`,
						{
							logType: LOG_TYPES.API,
							count: result?.length || 0,
							service: "ghost-api",
							method: "posts.browse",
						},
					);
					return result;
				} catch (error) {
					const err = error as Error;
					logGhostError(err, i + 1, maxRetries, request);

					// レート制限エラーの場合のみリトライ
					if (isRateLimitError(err)) {
						astroLogger.warn("Rate limit detected", {
							logType: LOG_TYPES.API,
							service: "ghost-api",
						});
						if (i === maxRetries - 1) {
							// 最後のリトライ失敗時は長期キャッシュを返す
							if (longTermCached) {
								astroLogger.warn(
									"Rate limit: Returning long-term cached data",
									{ logType: LOG_TYPES.API, service: "ghost-api" },
								);
								return longTermCached;
							} else {
								astroLogger.warn("Rate limit: No cached data available", {
									logType: LOG_TYPES.API,
									service: "ghost-api",
								});
								return null;
							}
						}
						// レート制限エラーの場合の待機時間
						const waitTime = 2000 * (i + 1); // 2秒、4秒、6秒
						console.log(`Waiting ${waitTime}ms before retry...`);
						await new Promise((resolve) => setTimeout(resolve, waitTime));
					} else {
						// レート制限エラー以外はリトライせずに長期キャッシュを返す
						if (longTermCached) {
							console.warn(
								"Non-rate-limit error: Returning long-term cached data",
							);
							return longTermCached;
						}
						return null;
					}

					// 待機時間を短くする（テスト環境では長すぎる）
					const waitTime = isRateLimitError(err)
						? 2000 * (i + 1) // 2秒、4秒、6秒
						: 1000 * (i + 1); // 1秒、2秒、3秒
					astroLogger.info(`Waiting ${waitTime}ms before retry...`, {
						logType: LOG_TYPES.API,
						waitTime,
						attempt: i + 1,
						service: "ghost-api",
					});
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
	},
	tags: {
		read: async (
			options: GhostTagOptions,
			maxRetries = 3,
			request?: Request,
		) => {
			// slugの検証を強化
			if (
				options.slug &&
				(typeof options.slug !== "string" ||
					options.slug.trim() === "" ||
					options.slug === "undefined" ||
					options.slug.includes("undefined"))
			) {
				astroLogger.warn("Invalid slug provided to Ghost tags API", {
					slug: options.slug,
					slugType: typeof options.slug,
					service: "ghost-api",
					logType: LOG_TYPES.API,
				});
				return null;
			}

			for (let i = 0; i < maxRetries; i++) {
				try {
					const { slug, ...cleanOptions } = options;
					if (slug) {
						const browseOptions = {
							filter: `slug:${encodeURIComponent(`'${slug}'`)}`,
							limit: 1,
							...cleanOptions,
						};
						const browseResult = await ghostClient.tags.browse(browseOptions);
						const result = browseResult?.[0] || null;
						return result;
					} else {
						const result = await ghostClient.tags.read(cleanOptions);
						return result;
					}
				} catch (error) {
					const err = error as Error;
					logGhostError(err, i + 1, maxRetries, request);

					// レート制限エラー以外（404含む）はリトライしない
					if (!isRateLimitError(err)) {
						return null;
					}

					if (i === maxRetries - 1) {
						return null;
					}
					// レート制限エラーの場合の待機時間
					const waitTime = 5000 * (i + 1); // 5秒、10秒、15秒
					astroLogger.info(`Waiting ${waitTime}ms before retry...`, {
						logType: LOG_TYPES.API,
						waitTime,
						attempt: i + 1,
						service: "ghost-api",
					});
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
		browse: async (
			options: GhostTagOptions,
			maxRetries = 3,
			request?: Request,
		) => {
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
					const err = error as Error;
					logGhostError(err, i + 1, maxRetries, request);

					// レート制限エラー以外（404含む）はリトライしない
					if (!isRateLimitError(err)) {
						return null;
					}

					if (i === maxRetries - 1) {
						return null;
					}
					// レート制限エラーの場合の待機時間
					const waitTime = 5000 * (i + 1); // 5秒、10秒、15秒
					astroLogger.info(`Waiting ${waitTime}ms before retry...`, {
						logType: LOG_TYPES.API,
						waitTime,
						attempt: i + 1,
						service: "ghost-api",
					});
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}
			}
		},
	},
};
