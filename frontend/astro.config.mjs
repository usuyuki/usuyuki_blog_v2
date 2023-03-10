import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

import image from "@astrojs/image";

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
  integrations: [tailwind(), image({
    serviceEntryPoint: '@astrojs/image/sharp'
  }
  )],
  server: {
    port: 1000,
    host: "0.0.0.0"
  },
  output: 'server',
  adapter: node({
    // middlewareだとファイルをうまくできずFW作る必要あるのでstandaloneで動かす
    mode: 'standalone'
  })
});
