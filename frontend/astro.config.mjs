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
				hostname: "blogapi.usuyuki.net"
			}
		],
		service: {
			entrypoint: "astro/assets/services/sharp",
			config: {
				limitInputPixels: false,
				avif: {
					quality: 85,
					effort: 4
				},
				webp: {
					quality: 90
				},
				jpeg: {
					quality: 85,
					progressive: true
				}
			}
		}
	},
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
