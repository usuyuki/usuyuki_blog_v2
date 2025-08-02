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
						error
					);
					if (i === maxRetries - 1) {
						return null;
					}
					await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
				}
			}
		},
		browse: async (options: GhostPostOptions, maxRetries = 3) => {
			for (let i = 0; i < maxRetries; i++) {
				try {
					const result = await ghostClient.posts.browse(options);
					return result;
				} catch (error) {
					console.error(
						`Ghost API error (attempt ${i + 1}/${maxRetries}):`,
						error
					);
					if (i === maxRetries - 1) {
						return null;
					}
					await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
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
						error
					);
					if (i === maxRetries - 1) {
						return null;
					}
					await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
				}
			}
		},
		browse: async (options: GhostTagOptions, maxRetries = 3) => {
			for (let i = 0; i < maxRetries; i++) {
				try {
					const result = await ghostClient.tags.browse(options);
					return result;
				} catch (error) {
					console.error(
						`Ghost API error (attempt ${i + 1}/${maxRetries}):`,
						error
					);
					if (i === maxRetries - 1) {
						return null;
					}
					await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
				}
			}
		},
	},
};
