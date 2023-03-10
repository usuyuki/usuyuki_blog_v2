import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.usuyuki.net',
  vite: {
    resolve: {
      alias: {
        '~': '/src',
        $components: '/src/components'
      }
    }
  },
  integrations: [sitemap(), tailwind()],
  output: "server",
  adapter: node({
    mode: "standalone"
  })
});