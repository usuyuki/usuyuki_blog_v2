import GhostContentAPI from "@tryghost/content-api";
import astroLogger from "./astroLogger";
import errorHandler from "./errorHandler";
import { LOG_TYPES } from "./logTypes";
import { getGhostApiUrl, getGhostContentKey } from "./env";

import type {
	PostsOrPages,
	Tags,
	PostOrPage,
	Tag,
} from "@tryghost/content-api";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

// Ghost APIのnullable型を内部型に変換(Astro内部ではnullableを気にしなくて良くなるようにしたいので)
function convertToArticleArchiveType(post: PostOrPage): ArticleArchiveType {
	return {
		slug: post.slug || "",
		published_at: post.published_at || "",
		feature_image: post.feature_image || undefined,
		title: post.title || "",
		excerpt: post.excerpt || undefined,
		isExternal: false,
	};
}

type GhostPostOptions = {
	slug?: string;
	id?: string;
	filter?: string;
	limit?: number;
	page?: number;
	order?: string;
	include?: string;
	fields?: string;
};

type GhostTagOptions = {
	slug?: string;
	id?: string;
	filter?: string;
	limit?: number;
	page?: number;
	order?: string;
	include?: string;
	fields?: string;
};

// Create API instance with site credentials
export const ghostClient = new GhostContentAPI({
	url: getGhostApiUrl(),
	key: getGhostContentKey(),
	version: "v6.0",
});

// キャッシュ用のシンプルなメモリストア
const cache = new Map<string, { data: object | null; expiry: number }>();

export function clearCache(): number {
	const clearedCount = cache.size;
	cache.clear();
	astroLogger.cacheLog("CLEAR", "all", false, {
		source: "ghost",
		clearedCount,
		operation: "manual_clear",
	});
	return clearedCount;
}

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

function setCache(key: string, data: object | null, ttlMs = 60000): void {
	cache.set(key, {
		data,
		expiry: Date.now() + ttlMs,
	});
	astroLogger.cacheLog("SET", key, false, { source: "ghost", ttl: ttlMs });
}

// 長期キャッシュ（1週間）
function setLongTermCache(key: string, data: object | null): void {
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
		): Promise<PostOrPage | null> => {
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

			// キャッシュをチェック（ポジティブキャッシュ）
			const cacheKey = getCacheKey("posts.read", options);
			const cached = getFromCache<PostOrPage>(cacheKey);
			if (cached) {
				astroLogger.cacheLog("HIT", cacheKey, true, {
					source: "ghost",
					method: "posts.read",
					slug: options.slug,
				});
				return cached;
			}

			// ネガティブキャッシュをチェック（404エラーのキャッシュ）
			const negativeCacheKey = `negative_${cacheKey}`;
			if (cache.has(negativeCacheKey)) {
				const cached = cache.get(negativeCacheKey);
				if (cached && cached.expiry > Date.now()) {
					astroLogger.cacheLog("HIT", negativeCacheKey, true, {
						source: "ghost",
						type: "negative",
						method: "posts.read",
						slug: options.slug,
					});
					return null;
				}
			}

			for (let i = 0; i < maxRetries; i++) {
				try {
					const { slug, ...cleanOptions } = options;
					if (slug) {
						const browseOptions = {
							filter: `slug:'${encodeURIComponent(slug)}'`,
							limit: 1,
							...cleanOptions,
						};
						const finalBrowseOptions: Record<
							string,
							string | number | undefined
						> = {};
						if (browseOptions.filter)
							finalBrowseOptions.filter = browseOptions.filter;
						if (browseOptions.limit)
							finalBrowseOptions.limit = browseOptions.limit;
						if (browseOptions.include)
							finalBrowseOptions.include = browseOptions.include;
						if (browseOptions.fields)
							finalBrowseOptions.fields = browseOptions.fields;

						const browseResult =
							await ghostClient.posts.browse(finalBrowseOptions);
						const result = browseResult?.[0] || null;

						// 結果をキャッシュに保存
						if (result) {
							// ポジティブキャッシュ（記事が見つかった場合）
							setCache(cacheKey, result, 3600000); // 1時間キャッシュ
							astroLogger.info("Ghost API success: fetched single post", {
								slug: options.slug,
								title: result.title,
								service: "ghost-api",
								logType: LOG_TYPES.API,
							});
							astroLogger.cacheLog("SET", cacheKey, false, {
								source: "ghost",
								method: "posts.read",
								slug: options.slug,
								ttl: 3600000,
							});
						} else {
							// ネガティブキャッシュ（記事が見つからなかった場合）
							setCache(negativeCacheKey, null, 3600000); // 1時間キャッシュ
							astroLogger.cacheLog("SET", negativeCacheKey, false, {
								source: "ghost",
								type: "negative",
								method: "posts.read",
								slug: options.slug,
								ttl: 3600000,
							});
						}

						return result;
					} else if (cleanOptions.id) {
						const result = await ghostClient.posts.read({
							id: cleanOptions.id,
						});

						// ID指定の場合もキャッシュ
						if (result) {
							setCache(cacheKey, result, 3600000);
							astroLogger.cacheLog("SET", cacheKey, false, {
								source: "ghost",
								method: "posts.read",
								id: cleanOptions.id,
								ttl: 3600000,
							});
						} else {
							setCache(negativeCacheKey, null, 3600000);
							astroLogger.cacheLog("SET", negativeCacheKey, false, {
								source: "ghost",
								type: "negative",
								method: "posts.read",
								id: cleanOptions.id,
								ttl: 3600000,
							});
						}

						return result;
					} else {
						return null;
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
			return null;
		},
		browse: async (
			options: GhostPostOptions,
			maxRetries = 3,
			request?: Request,
		): Promise<ArticleArchiveType[] | null> => {
			// 通常キャッシュをチェック
			const cacheKey = getCacheKey("posts.browse", options);
			const cached = getFromCache<PostsOrPages>(cacheKey);
			if (cached) {
				return cached.map(convertToArticleArchiveType);
			}

			// 長期キャッシュもチェック
			const longTermCached = getLongTermCache<PostsOrPages>(cacheKey);

			for (let i = 0; i < maxRetries; i++) {
				try {
					const browseOptions: Record<string, string | number | undefined> = {};
					if (options.filter) browseOptions.filter = options.filter;
					if (options.limit) browseOptions.limit = options.limit;
					if (options.page) browseOptions.page = options.page;
					if (options.order) browseOptions.order = options.order;
					if (options.fields) browseOptions.fields = options.fields;
					if (options.include) browseOptions.include = options.include;

					const result = await ghostClient.posts.browse(browseOptions);
					// 成功時に通常と長期両方のキャッシュに保存（生データをキャッシュ）
					setCache(cacheKey, result, 3600000); // 1時間キャッシュ
					setLongTermCache(cacheKey, result); // 1週間キャッシュ
					astroLogger.info(
						`Ghost API success: fetched ${result?.length || 0} posts`,
						{
							logType: LOG_TYPES.API,
							count: result?.length || 0,
							service: "ghost-api",
							method: "posts.browse",
							page: options.page,
							limit: options.limit,
						},
					);
					// 変換した結果を返す
					return result.map(convertToArticleArchiveType);
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
								return longTermCached.map(convertToArticleArchiveType);
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
							return longTermCached.map(convertToArticleArchiveType);
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
			return null;
		},
	},
	tags: {
		read: async (
			options: GhostTagOptions,
			maxRetries = 3,
			request?: Request,
		): Promise<Tag | null> => {
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
							filter: `slug:'${encodeURIComponent(slug)}'`,
							limit: 1,
							...cleanOptions,
						};
						const finalBrowseOptions: Record<
							string,
							string | number | undefined
						> = {};
						if (browseOptions.filter)
							finalBrowseOptions.filter = browseOptions.filter;
						if (browseOptions.limit)
							finalBrowseOptions.limit = browseOptions.limit;
						if (browseOptions.fields)
							finalBrowseOptions.fields = browseOptions.fields;

						const browseResult =
							await ghostClient.tags.browse(finalBrowseOptions);
						const result = browseResult?.[0] || null;
						return result;
					} else if (cleanOptions.id) {
						const result = await ghostClient.tags.read({ id: cleanOptions.id });
						return result;
					} else {
						return null;
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
			return null;
		},
		browse: async (
			options: GhostTagOptions,
			maxRetries = 3,
			request?: Request,
		): Promise<Tags | null> => {
			// キャッシュをチェック
			const cacheKey = getCacheKey("tags.browse", options);
			const cached = getFromCache<Tags>(cacheKey);
			if (cached) {
				return cached;
			}

			for (let i = 0; i < maxRetries; i++) {
				try {
					const browseOptions: Record<string, string | number | undefined> = {};
					if (options.filter) browseOptions.filter = options.filter;
					if (options.limit) browseOptions.limit = options.limit;
					if (options.page) browseOptions.page = options.page;
					if (options.order) browseOptions.order = options.order;
					if (options.fields) browseOptions.fields = options.fields;

					const result = await ghostClient.tags.browse(browseOptions);
					// 成功時にキャッシュに保存
					setCache(cacheKey, result, 3600000); // 1時間キャッシュ（レート制限対策）
					return result;
				} catch (error) {
					const err = error as Error;
					logGhostError(err, i + 1, maxRetries, request);

					// レート制限エラー以外（404含む）はリトライしない
					if (!isRateLimitError(err)) {
						// 404エラーの場合はネガティブキャッシュに保存
						const errResponse = err as { response?: { status?: number } };
						if (errResponse?.response?.status === 404) {
							const negativeCacheKey = `negative_${cacheKey}`;
							setCache(negativeCacheKey, null, 3600000); // 1時間キャッシュ
							astroLogger.cacheLog("SET", negativeCacheKey, false, {
								source: "ghost",
								type: "negative",
								method: "posts.read",
								slug: options.slug,
								status: 404,
								ttl: 3600000,
							});
						}
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
			return null;
		},
	},
};
