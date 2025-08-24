import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";
// biome-ignore lint/suspicious/noTsIgnore: Type definitions conflict with custom types
// @ts-ignore
import GhostContentAPI from "@tryghost/content-api";

// Ghost API client for sitemap generation
const ghostClient = new GhostContentAPI({
	url: process.env.GHOST_API_URL,
	key: process.env.GHOST_CONTENT_KEY,
	version: "v5.0",
});

// https://astro.build/config
export default defineConfig({
	site: "https://blog.usuyuki.net",
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				// tsconfig.jsonにも定義
				"~": "/src",
			},
		},
	},
	integrations: [
		svelte(), 
		sitemap({
			customPages: async () => {
				try {
					const posts = await ghostClient.posts.browse({ 
						limit: 'all',
						fields: 'slug,updated_at'
					});
					return posts?.map(post => `https://blog.usuyuki.net/${post.slug}`) || [];
				} catch (error) {
					console.warn('Failed to fetch Ghost posts for sitemap:', error);
					return [];
				}
			}
		})
	],
	server: {
		port: 1000,
		host: "0.0.0.0",
	},
	// ほとんどのページが動的に変わるのでAstro2.6からのhybridは使わず従来のserverで変わらないところだけprerender=trueで対処
	output: "server",
	adapter: node({
		// middlewareだとファイルをうまくできずFW作る必要あるのでstandaloneで動かす
		mode: "standalone",
	}),
});
