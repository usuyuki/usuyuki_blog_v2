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
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // MacのDocker Desktopはバインドマウント越しにinotifyイベントが届かないためポーリングで検知する。
        // CHOKIDAR_USEPOLLING環境変数はプロセス内の全chokidar(unstorage等)をポーリング化して
        // libuvスレッドプールを飽和させdevサーバーが起動不能になるため使わず、
        // viteのwatcherに限定して有効化し、監視不要なディレクトリを明示的に除外する
        usePolling: true,
        interval: 300,
        binaryInterval: 1000,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.astro/**", "**/dist/**"],
      },
    },
    resolve: {
      alias: {
        // tsconfig.jsonにも定義
        "~": "/src",
      },
    },
    build: {
      rollupOptions: {
        external: [/winston/, /@prisma/, /\.prisma/],
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
