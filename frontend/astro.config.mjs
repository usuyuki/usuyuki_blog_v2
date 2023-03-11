import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

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
	integrations: [sitemap(), tailwind()],
	output: 'server',
	adapter: node({
		// middlewareだとファイルをうまくできずFW作る必要あるのでstandaloneで動かす
		mode: 'standalone'
	})
});
