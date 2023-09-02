import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.usuyuki.net',
	vite: {
		resolve: {
			alias: {
				// tsconfig.jsonにも定義
				'~': '/src'
			}
		}
	},
	integrations: [tailwind()],
	server: {
		port: 1000,
		host: '0.0.0.0'
	},
	// ほとんどのページが動的に変わるのでAstro2.6からのhybridは使わず従来のserverで変わらないところだけprerender=trueで対処
	output: 'server',
	adapter: node({
		// middlewareだとファイルをうまくできずFW作る必要あるのでstandaloneで動かす
		mode: 'standalone'
	})
});
