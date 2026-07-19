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
        // CHOKIDAR_USEPOLLING環境変数はプロセス内の全chokidarをポーリング化してしまい
        // libuvスレッドプールが飽和してdevサーバーが起動不能になるため、viteのwatcherに限定する。
        // chokidar v4はglob文字列のignoredを解釈しないため、関数で確実にnode_modules等を除外する
        usePolling: true,
        interval: 1000,
        ignored: (path) =>
          path.includes("/node_modules/") ||
          path.includes("/.git/") ||
          path.includes("/dist/") ||
          path.includes("/.astro/"),
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
