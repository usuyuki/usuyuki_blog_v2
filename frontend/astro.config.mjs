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
        // 特に/frontend/.pnpm-store(5万ファイル超)はviteのデフォルト除外に含まれず、
        // ポーリングさせると起動不能になるため必ず除外する。glob文字列はchokidarの
        // バージョンにより解釈されないことがあるため関数で確実に除外する
        usePolling: true,
        interval: 1000,
        ignored: (path) =>
          path.includes("/node_modules/") ||
          path.includes("/.pnpm-store/") ||
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
  // ClientRouter(View Transitions)利用時、既定のprefetch戦略は"hover"でmouseenter依存のため
  // タッチ操作しかないスマホでは一切prefetchされず、タップ後にHTML取得を待ってから
  // startViewTransitionが始まりアニメーションがカクつく。"tap"はtouchstart/mousedownで
  // 即座にprefetchを開始するためモバイルでも遷移先HTMLの先読みが効くようにする。
  // prefetchAllを指定しないとdefaultStrategyはdata-astro-prefetch属性を明示した
  // リンクにしか適用されず(サイト内にその属性を持つリンクが無いため)実質無効になるので必須
  prefetch: {
    defaultStrategy: "tap",
    prefetchAll: true,
  },
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
