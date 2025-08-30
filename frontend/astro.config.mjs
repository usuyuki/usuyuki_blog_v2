import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import partytown from "@astrojs/partytown";

// https://astro.build/config
export default defineConfig({
	site: "https://blog.usuyuki.net",
	image: {
		domains: ["blogapi.usuyuki.net"],
		remotePatterns: [
			{
				protocol: "https",
				hostname: "blogapi.usuyuki.net",
			},
		],
	},
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				// tsconfig.jsonにも定義
				"~": "/src",
			},
		},
		build: {
			rollupOptions: {
				external: (id) => {
					return id.includes("winston");
				},
			},
		},
		define: {
			"import.meta.env.GHOST_API_URL": JSON.stringify(
				process.env.GHOST_API_URL,
			),
			"import.meta.env.GHOST_CONTENT_KEY": JSON.stringify(
				process.env.GHOST_CONTENT_KEY,
			),
			"import.meta.env.EXTERNAL_BLOGS": JSON.stringify(
				process.env.EXTERNAL_BLOGS,
			),
			"import.meta.env.FRONTEND_URL": JSON.stringify(process.env.FRONTEND_URL),
		},
	},
	integrations: [
		svelte(),
		partytown({
			config: {
				forward: ["dataLayer.push"],
			},
		}),
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
