# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Current Status**: Project runs on Ghost v6 API with an article aggregation system that combines internal Ghost CMS content with external sources (Qiita API, Zenn RSS, etc.). Ghost v6 API has a maximum limit of 100 posts per request, requiring pagination for larger datasets. Qiita articles are fetched via Qiita API v2 (full history, paginated) instead of RSS.

## Project Overview

This is a blog application with two main components:
- **Backend**: Ghost CMS (headless)
- **Frontend**: Astro-based static site generator with server-side rendering

> **IMPORTANT**: The frontend is built with **Astro**, NOT plain HTML/JS/React/Vue.
> Astro has its own file format (`.astro`), its own routing conventions, and its own
> build/SSR model. Do NOT suggest or write vanilla HTML, plain JS bundles, or
> framework-specific patterns that don't apply to Astro. Always follow Astro idioms:
> frontmatter script blocks, Astro components, content collections, and SSR endpoints.

## Architecture

The project uses a Docker-based development and deployment setup:
- Frontend runs on **Node.js 26** (`node:26-slim`) + **Astro 7** (`astro@7.3.5`) with **Tailwind CSS 4** and **Svelte 5**
- **Dependency layout**: `dependencies` in `frontend/package.json` contains ONLY packages imported at runtime by the SSR bundle (`@astrojs/rss`, `@prisma/adapter-mariadb`, `@prisma/client`, `@tryghost/content-api`, `jsdom`, `sharp`, `shiki`, `winston`). Everything used only at build time (astro itself, adapters, integrations, tailwindcss, svelte, emoji-picker-element, mermaid(クライアントバンドルにのみ含まれる), etc.) lives in `devDependencies` so the production image can drop them with `pnpm prune --prod`. When adding a package, decide based on whether the built server (`dist/server`) imports it at runtime.
- Backend uses **Ghost CMS 6** as a headless CMS
- Production deployment uses Docker containers with GitHub Actions CI/CD
- **ログ**: ブログ自身はGrafana / Loki / Alloyを持たない。本番のログは共通のGrafanaで見る(下記「本番ログ調査（gcx）」を参照)
- イメージタグの選び方は下記「Docker イメージタグの方針」を参照

## Development Commands

**IMPORTANT: NEVER run `pnpm` commands directly on the host. ALWAYS use `docker compose exec astro pnpm` to ensure commands run inside the container with the correct store and environment.**

**Note**: In development, `node_modules` is stored in a named Docker volume (`astro-node-modules`), not in the host bind mount. This avoids slow VirtioFS I/O on macOS. To reset dependencies completely, remove the volume: `docker compose down && docker volume rm usuyuki_blog_v2_astro-node-modules && docker compose up -d`.

All development work happens in the `frontend/` directory. Use these commands:

```bash
# Development server (NOTE: DO NOT run 'make dev' or 'pnpm dev' manually)
# The development server starts automatically when containers are launched
# and runs continuously in the background

# Complete build pipeline (format, lint, check, build)
make 1
# or
docker compose exec astro pnpm 1

# Individual commands
docker compose exec astro pnpm build
docker compose exec astro pnpm check      # Astro type checking
docker compose exec astro pnpm lint       # Biome linting and checking
docker compose exec astro pnpm format     # Biome formatting

# Regenerate Prisma Client (run after changing prisma/schema.prisma)
make prisma
# or
docker compose exec astro pnpm exec prisma generate

# Access shell in container
make sh
# or
docker compose exec astro sh

# Install new packages/libraries
docker compose exec astro pnpm add <package-name>
# After installing new packages, restart the container to ensure proper loading
docker compose restart astro
```

## Production Deployment

Test production build:
```bash
docker compose down
docker compose -f compose-prod.yml up -d --build
```

Production update (no downtime):
```bash
docker pull ghost:6-alpine && docker pull cloudflare/cloudflared:latest && docker pull mysql:8.4 && docker pull ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest
docker compose -f compose-prod.yml up -d --remove-orphans
```

### Docker イメージタグの方針
`compose.yml` / `compose-prod.yml` のイメージは**メジャーバージョンだけをタグで指定する**(例: `ghost:6-alpine`)。マイナー・パッチバージョンの指定はできる限り避け、`docker pull` するだけでセキュリティ修正などの非破壊的な更新が取り込まれるようにする。一方でメジャーアップデートは破壊的変更を含みうるため、タグを書き換えて明示的に上げる。

メジャータグが配布されていないなど、方針どおりにできないイメージは以下の例外とする。

| イメージ | タグ | 理由 |
| --- | --- | --- |
| `cloudflare/cloudflared` | `latest` | 日付ベースのバージョンでメジャーの概念が無い |
| `mysql` | `8.4` | 8系のLTSリリース。データを持つため明示的に固定する |
| `ghcr.io/usuyuki/usuyuki_blog_v2_astro` | `latest` | 自前ビルドのイメージでCI/CDが常に最新を出す |

`docker compose up -d` だけではキャッシュ済みイメージは再取得されないため、更新時は上記Production updateの `docker pull` を必ず実行する。イメージやタグを変えたら、そのコマンドの pull 対象も合わせて更新する。

## Component Architecture

The frontend follows Atomic Design principles:
- **Atom**: Basic components with no dependencies or state
- **Molecule**: Components that depend on other components
- **Organism**: Components that fetch external data or manage state

## Design System

エディトリアル(新聞・雑誌)調のデザイン。原典は `wire/` のワイヤーフレーム3枚(トップ・記事一覧・記事詳細のHTML)。

- **デザイントークン**: `frontend/src/styles/tailwind.css` の `@theme` で定義 — `--color-ink: #141414`(文字・罫線)/ `--color-paper: #ffffff`(背景)/ `--color-gray: #f4f3f0` / `--color-orange: #ff5c00`(アクセント)/ `--font-display`・`--font-en`(システムサンセリフ。Webフォントは使わない)
- **共通変数**: `frontend/src/styles/global.css` — `--bw: 2px`(基本罫線幅)/ `--max-w: 1240px`(`.container` の最大幅)/ `--article-max-width: 760px` / `--font-ja-heading`(英数字も日本語フォントで描画する太字用。本文フォントは英数字がHelveticaになり、太字だと日本語と太さ・大きさがずれるため、h1〜h6の既定書体とし、本文の`strong`/`b`・タグ一覧・前後記事タイトルなど見出し以外の太字にも指定する。英字だけの見出しは`--font-display`を使う)
- **目次**: `molecule/article/ArticleToc.astro` は `numberTOC`(`libs/helper/generateTOC.ts`)で見出し階層に応じた番号(`1` / `2.1` / `2.1.1`)を振る。見出しレベルが飛んでも空の階層は作らない
- **原則**: 角丸なし(`rounded-*` を使わない)、2px罫線で構造を見せる、英字見出しは900ウェイト+letter-spacing、ホバーは黒反転か下線
- **スクロールバー**: ページ内のスクロール領域(目次・リアクション一覧・表・コードブロック等)は `global.css` で6px・角なし・オレンジ(`--color-orange`)のつまみ・グレー(`--color-border-light`)のレールに統一(黒だと罫線や本文に紛れて気付きにくく、レールが無いとスクロールできる範囲が分からないため。黒背景のコードブロックだけレールを`--color-ink-border`にする)。Chrome/Safariは`::-webkit-scrollbar`で描き、標準の`scrollbar-width`/`scrollbar-color`は`@supports (-moz-appearance: none)`でFirefoxだけに当てる(標準プロパティを指定するとChromeが`::-webkit-scrollbar`を無視して丸いつまみになるため)。ページ全体のスクロールバーは変えない
- **レイアウト**: `main` はフルブリード。各セクションが内側に `.container` を持つ
- **共通シェル**: `molecule/header/SiteHeader.astro`(sticky、ハンバーガー、Google検索フォーム。ナビは TOP/ALL/TAGS/ABOUT)+ `atom/footer/SiteFooter.astro`(黒ベタ+巨大タイポ。RSSリンクはフッターのSite Mapに配置)
- **記事セル**: `molecule/articleArchive/ArticleCell.astro`(+`ArticleCellGrid.astro`)をトップ/一覧/タグ/関連記事で共用。外部記事(Qiita/Zenn)はソース名バッジ付きで外部リンク。`transition` propで記事詳細ページとのView Transitions連携(サムネ・タイトルのクロスフェード)を個別に有効化できる(`transition:name`は値をundefinedにしても要素の自動生成名が残ってしまうため、Astroコンパイラの制約でJSX側の分岐で出し分けている)
- **クライアントスクリプト**: `src/scripts/globalNav.ts`(ハンバーガー)/ `reveal.ts`(スクロール出現)/ `tocSidebar.ts`(目次スクロールスパイ)/ `mermaidRenderer.ts`(記事本文の`.mermaid`ブロックを[mermaid.js](https://mermaid.js.org/)で描画。ブロックが無い記事ではmermaid.js自体を動的importしない。mermaid 12でレイアウトエンジンの既定がdagre→ELK、lookの既定がclassic→neoに変わり既存記事の図の見た目が変化するため、`layout: "dagre"`/`look: "classic"`を明示して従来の描画を維持している)。すべて `astro:page-load` で初期化(ClientRouter対応)
- **View Transitions / prefetch**: `astro.config.mjs` で `prefetch.defaultStrategy: "tap"` と `prefetch.prefetchAll: true` を指定。既定の `"hover"` は `mouseenter` 依存でスマホのタッチ操作では発火せず、ページ遷移時に毎回HTML取得を待ってから `startViewTransition` が始まりアニメーションがカクつくため、`touchstart`/`mousedown` で即座にprefetchする `"tap"` に変更している。`prefetchAll: true` が無いと `defaultStrategy` は `data-astro-prefetch` 属性を明示したリンクにしか適用されず(サイト内にその属性を持つリンクは無い)実質無効になるため必須

## Key Files and Directories

- `frontend/src/consts.ts` - Site configuration constants(`SITE_TITLE_EN`: ヘッダー/フッター共用の英字ブランド表記、`SOCIAL_LINKS`: SNS・外部プロフィールリンクの一覧。console banner(`libs/console/snsLinkProvider.ts`)も含め表記揺れを避けるためこれらを唯一の情報源とする)
- `frontend/src/libs/ghostClient.ts` - Ghost CMS API client with retry logic and caching (posts.browse は `include: "tags"` で公開タグも変換)
- `frontend/src/libs/astroLogger.ts` - Winston-based structured logger(標準出力に書くだけで、Lokiへは直接送らない。コンテナの標準出力が共通のGrafana側で収集される)
- `frontend/src/libs/articleAggregator.ts` - Unified article aggregation from Ghost, RSS feeds, and Qiita API (`getLatestArticles` / `getAllArticlesCached`(第2引数`forceRefresh`でキャッシュを無視して再取得。強制再取得は記事詳細ページ・公開記事判定と共通で1分に1回までに抑え、間隔内はキャッシュを使う。Ghostへの問い合わせが失敗した結果はキャッシュしない — Docker再起動直後などGhostが未起動でも外部記事(RSS/Qiita)だけは取得できてしまい、Ghost記事が欠けた不完全な結果を1時間キャッシュすると記事が表示されなくなるため。同時に呼ばれた場合は取得中のPromiseを共有し、Ghostへの全件取得を1回にまとめる) / `checkPublishedGhostSlug`(リアクションPOST用の公開記事判定。`"published"`/`"not_found"`/`"unavailable"`を返す。一覧が5分より古い・slugが見つからない場合は取り直すが、Ghostへの取り直しは1分に1回までに抑える。取得中のものがあればその結果を待つ) / `getAllGhostArticlesForArticlePage`(記事詳細用。指定slugがキャッシュに無ければ自動で強制再取得(1分に1回まで)し、鮮度確認済みの全記事配列を返す) / `getAdjacentArticles`(前後記事、外部記事は除外。第2引数に`getAllGhostArticlesForArticlePage`の結果を渡す) / `getRelatedArticles`(タグベース関連記事。`options.allGhostArticles`を渡すとタグ一致・補完の両方をin-memoryで処理しGhostへのライブフェッチを回避) / `getFeaturedArticles`)
- `frontend/src/libs/helper/archiveQuery.ts` - 記事一覧のフィルター・ソート・ページネーション純関数 (`filterByYear` / `sortArticles` / `paginate` / `buildPageList` / `buildArchiveUrl`)
- `frontend/src/libs/helper/formatDotDate.ts` - `2026.06.18` 形式の日付フォーマッタ
- `frontend/src/libs/helper/cacheClearToken.ts` - `isCacheClearTokenValid()`で記事詳細ページの`?debug=`を環境変数`CACHE_CLEAR_TOKEN`と定数時間比較する(未設定なら手動キャッシュクリア無効)
- `frontend/src/libs/helper/clientIp.ts` - `resolveClientIp()`でクライアントIPを決定する。`CF-Connecting-IP`は`TRUST_CF_CONNECTING_IP=true`のとき(本番。cloudflared経由でしか到達できない)だけ信用し、それ以外は接続元アドレスを使う。`toRateLimitKey()`はIPv6を/64プレフィックスにまとめる(IPv4射影アドレスはIPv4として扱う)
- `frontend/src/libs/rateLimiter.ts` - インメモリの固定ウィンドウ型レートリミッター。`/api/reactions/[slug]`のPOSTを利用者単位で1分30回に制限。保持キー数は`maxKeys`(既定1万)を上限とし、上限に達したら最も早く期限切れになるキーを追い出して受け付ける(新規キーを拒否すると、大量のキーを作るだけで全員を締め出せるため)。期限切れキーはMapの挿入順(=期限順)で先頭から掃除する
- `frontend/src/pages/api/reactions/[slug].ts` - 絵文字リアクションAPI。`isSlug()`で不正slugを400、POSTはレート制限(429。キーはIP(IPv6は/64)、IPが取れなければ全員共有の1枠。cookieのclientIdは作り直せるのでキーにしない)と公開済みGhost記事の存在確認(`checkPublishedGhostSlug`、無ければ404・一覧取得不可なら503)を経てから保存する
- `frontend/src/libs/helper/reactionErrorMessage.ts` - `getReactionErrorMessage()`でリアクションPOST失敗時(429/404/503/通信失敗など)に`EmojiReaction.svelte`が表示するメッセージを返す
- `infra/db/cleanup/` - slug検証を入れる前に保存された不正slugのリアクション行を扱う一回限りのSQL(手動実行)。`select_invalid_slug_reactions.sql`で対象を確認し、`delete_invalid_slug_reactions.sql`で削除する。削除条件は両ファイルと`isSlug()`でそろえる
- `frontend/src/libs/helper/articleCell.ts` - 記事セルのリンク・View Transitions名・サムネ代替・公開タグ抽出(`getPublicTags`)・画像フォールバック(`IMAGE_FALLBACK_ONERROR`)のヘルパー
- `frontend/src/libs/helper/getImageDimensions.ts` - 画像URLをfetchしsharpで幅・高さを取得(`og:image:width`/`height`用、1時間キャッシュ、fetchは5秒でタイムアウト)。Misskeyなど外部サービスのOGPプレビュー生成がサイズ情報を要求するため記事詳細ページ(`[slug].astro`)で使用
- `frontend/src/libs/helper/highlightCodeBlocks.ts` - 記事本文HTML中の`<pre><code class="language-XXX">`をjsdomで検出し、`language-mermaid`は`<pre class="mermaid">`(クライアント側`mermaidRenderer.ts`が描画)に、それ以外は[Shiki](https://shiki.style/)でSSR時にハイライト済みHTMLへ変換する。未対応言語は例外を吸収しプレーンテキストのまま維持([ADR-00002](./adr/00002-mermaid-and-syntax-highlight.md)参照)
- `frontend/src/libs/helper/shikiTheme.ts` - `--color-ink`/`--color-orange`等の既存デザイントークンに合わせたカスタムShikiテーマ(`usuyuki-editorial`)
- `frontend/src/libs/helper/ogpMeta.ts` - `buildFixedOgpMeta()`で固定OGP画像(`images/ogp/ogp.png`)のog:image/width/heightをまとめて返す。トップ・404・タグ一覧など固定画像を使う全ページ、および記事詳細で`feature_image`が無い/サイズ取得に失敗した場合のフォールバックで共用
- `frontend/src/libs/rssClient.ts` - RSS feed processing for external blogs (Zenn, note, etc.)
- `frontend/src/libs/qiitaClient.ts` - Qiita API v2 client with pagination and caching (full article history)
- `frontend/src/libs/config.ts` - Configuration management for external integrations
- `frontend/src/libs/errorHandler.ts` - Centralized error handling and logging
- `frontend/src/libs/cache.ts` - In-memory caching system for API responses
- `frontend/src/components/` - Astro components organized by atomic design
- `frontend/src/pages/` - Astro pages and routes (`/archive` は `?year=&sort=&page=` のSSRクエリパラメータ方式。旧 `/archive/[year]`・`/archive/[year]/[month]` は301で `/archive?year=` へリダイレクト。`/tags` はタグ一覧ページで、ヘッダーのTAGSナビのリンク先)
- `frontend/src/styles/` - CSS files including Ghost content styling (`blog/blogCommon.css` が記事本文タイポグラフィ)
- `wire/` - 新デザインのワイヤーフレーム(HTML3枚、デザインの原典)
- `frontend/e2e/` - Playwright E2Eテスト(3ブラウザの表示検査)と`mock-ghost/`(Ghost Content APIモックサーバー+fixture)。設定は`frontend/playwright.config.ts`
- `compose.yml` - Development Docker configuration
- `compose-prod.yml` - Production Docker configuration

### 起動順序 (Ghost → astro)
astroがGhostより先に起動すると記事を取得できないまま立ち上がってしまうため、2段構えで防いでいる。

| 層 | 仕組み |
| --- | --- |
| Docker | `ghost`サービスに`healthcheck`(認証なしで200を返すAdmin APIの`/ghost/api/admin/site/`へ`X-Forwarded-Proto: https`付きでwgetし、2xxが返ることを確認。ヘッダーが無いと`url`がhttpsの本番ではGhostが公開URLへ301で飛ばし、Cloudflare経由の公開サイトを確認してしまう)を定義し、`astro`の`depends_on`を`ghost: condition: service_healthy`にして待機させる |
| アプリ | `getAllArticlesCached`はGhostへの問い合わせが失敗した回の結果をキャッシュしない。外部記事(RSS/Qiita)だけは取得できてしまうため、Ghost記事が欠けた結果を1時間キャッシュすると記事が出ないまま固定される |

healthcheckの`test`は`localhost`ではなく`127.0.0.1`を使う(`localhost`はIPv6に解決され接続拒否になる)。無効なキーでContent APIを叩く方式にしてはいけない。Ghostの総当たり対策が失敗を数えて429を返し、10秒ごとにERRORログが出てエラーのアラートを埋もれさせる。

## Logging

Use `astroLogger` for all logging operations throughout the application:

```typescript
import astroLogger from '../libs/astroLogger.ts';

// Basic logging
astroLogger.info('Operation completed');
astroLogger.warn('Warning message');
astroLogger.error('Error occurred', error);
astroLogger.debug('Debug information');

// Structured logging with context
astroLogger.info('User action', {
  component: 'UserComponent',
  route: '/user/profile',
  method: 'POST'
});

// Specialized logging methods
astroLogger.requestLog(request, response, duration);
astroLogger.componentError('ComponentName', error);
astroLogger.apiError('/api/endpoint', error);
astroLogger.cacheLog('get', 'cache-key', true);
astroLogger.systemLog('System startup completed');
```

## Environment Variables

### Required Variables
- `BACKEND_API_URL` - Ghost CMS backend URL (e.g., http://localhost:1001)
- `GHOST_API_URL` - Ghost CMS API endpoint
- `GHOST_CONTENT_KEY` - Ghost CMS content API key
- `FRONTEND_URL` - Frontend application URL (e.g., http://localhost:1000)
- `GHOST_FRONT_URL` - Ghost frontend URL for admin interface

### Optional Variables
- `TUNNEL_TOKEN` - Cloudflare tunnel token for production deployment
- `EXTERNAL_BLOGS` - JSON array of external blog sources for article aggregation
  - `qiitaUserId` を指定するとQiita API v2で全記事取得（RSSより優先）
  - `rssUrl` を指定するとRSSフィードで取得（Zenn、noteなど）
  ```json
  [
    {"name": "Qiita", "qiitaUserId": "username", "color": "#55c500"},
    {"name": "Zenn", "rssUrl": "https://zenn.dev/username/feed", "color": "#3ea8ff"},
    {"name": "note", "rssUrl": "https://note.com/username/rss", "color": "#41c9b4"}
  ]
  ```
- `CACHE_CLEAR_TOKEN` - 記事詳細ページの `?debug=<値>` で全インメモリキャッシュを消去するためのトークン。未設定なら機能無効。秘密値なのでSSR時の`process.env`からのみ読む
- `TRUST_CF_CONNECTING_IP` - `"true"`のときだけ`CF-Connecting-IP`ヘッダーをクライアントIPとして信用する。cloudflared経由でしか到達できない本番(`compose-prod.yml`)でのみ設定する。ポートを公開する環境で有効にするとヘッダー偽装でレート制限を回避される

## Code Style Guidelines

- Comments are allowed. Add them where they help clarify intent or non-obvious logic.
- **MUST add tests**: Every new code change (components, libraries, API routes, types) requires corresponding tests. Do NOT consider any task complete without tests.
- **MUST fix warnings**: `pnpm check` must complete with 0 errors and 0 warnings. Fix all TypeScript warnings (unused imports, unused variables, etc.) before considering a task complete.
- **MUST update docs**: When implementation changes affect architecture, key files, environment variables, or external integrations, update both `CLAUDE.md` and `README.md` to reflect the changes.

## Testing and Quality Assurance

### Testing Framework
The project uses **Vitest** with Testing Library for comprehensive testing:

```bash
# Run tests in watch mode
docker compose exec astro pnpm test

# Run tests once
docker compose exec astro pnpm test:run

# Run tests with UI
docker compose exec astro pnpm test:ui
```

### E2E Testing (Playwright)
**Playwright** で chromium / firefox / webkit の3ブラウザの表示崩れ（横スクロール・主要要素の欠落・未捕捉JSエラー）を検査する。

- 構成: `frontend/e2e/mock-ghost/server.mjs`（Ghost Content APIモック）とビルド済みSSRサーバー（`dist/server/entry.mjs`）を `playwright.config.ts` の `webServer` が自動起動する。実際のGhost・DB・外部APIには接続しない
- fixture: `frontend/e2e/mock-ghost/fixtures.mjs`（12記事・3タグの固定データ）。specファイルがslugやタグ名を参照しているため、fixtureを変更したらspecも合わせて更新する
- CI: `.github/workflows/e2e.yml`（PRごとに実行。ブラウザバイナリは `~/.cache/ms-playwright` をPlaywrightバージョンでキャッシュ）
- `make 1` にE2Eは含まれない（ブラウザバイナリが必要なため）

```bash
# 初回のみ: コンテナ内にブラウザをインストール（apt実行のためroot）
docker compose exec -u root astro pnpm exec playwright install --with-deps chromium firefox webkit

# ビルドしてからE2Eを実行（ブラウザが/root/.cache配下にあるためrootで実行）
docker compose exec astro pnpm build
docker compose exec -u root astro pnpm test:e2e
docker compose exec -u root astro pnpm test:e2e --project=chromium  # 1ブラウザのみ
```

### Writing Tests
**IMPORTANT**: When adding new code, always write corresponding tests:

- **Components**: Place tests in `__tests__/` directory next to the component
- **Libraries**: Place tests in `libs/__tests__/` directory
- **API Routes**: Place tests in `pages/api/__test__/` directory
- **Types**: Place tests in `types/__tests__/` directory

Example test structure:
```typescript
// src/components/organism/article/__tests__/ComponentName.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ComponentName from '../ComponentName.svelte';

describe('ComponentName', () => {
  it('should render correctly', () => {
    const { getByText } = render(ComponentName);
    expect(getByText('Expected text')).toBeInTheDocument();
  });
});
```

### Complete Pipeline
Always run the complete pipeline before committing:
```bash
make 1
```

This runs:
1. Biome formatting
2. Biome linting and checking
3. Astro type checking
4. **All tests** (vitest run)
5. Build process

**IMPORTANT**: Always verify that `make 1` completes without any errors before considering any task complete. This ensures code quality and prevents broken builds.

## Caching System

The application uses multiple layers of caching for performance:

### In-Memory Application Cache
- **Location**: `frontend/src/libs/cache.ts`
- **Scope**: In-memory cache that persists during container runtime
- **Used by**: 記事一覧ページ・前後記事ナビ (`getAllArticlesCached`、キー `aggregated_all_articles:v4:*`), Ghost client, RSS client, Qiita API client
- **Cache Duration**: 
  - Aggregated articles: 1 hour (`ONE_HOUR_MS`)。ただしGhostの取得に失敗した回はキャッシュをスキップする
  - Ghost API responses: 1 hour (configurable per endpoint)
  - RSS feed responses: 1 hour
  - Qiita API responses: 1 hour (cache key: `qiita_api:{userId}`)

### Cache Management Commands

```bash
# Clear all caches by restarting containers
docker compose restart astro

# For production
docker compose -f compose-prod.yml restart astro
```

### Important Notes
- **Cache Keys**: When modifying data aggregation logic (like `articleAggregator.ts`), change cache keys to force cache invalidation
- **Development**: Caches persist until container restart - always restart after significant changes
- **Production**: Caches improve performance but may require container restart for immediate updates
- **Ghost Client Cache**: Individual Ghost API calls are cached with TTL, check logs for cache HIT/MISS status

## Monitoring and Observability

ブログ自身はGrafana / Loki / Alloyを持たない。ログの収集・可視化・アラートはumi.mikanと共通のGrafanaにまとめている。

| 用途 | 場所 |
| --- | --- |
| ログ収集 | コンテナの標準出力が共通のGrafanaのLokiに集められる。ブログ側にラベルなどの設定は要らない |
| ログ閲覧 | 共通のGrafana(http://192.168.37.112:2008、LAN内のみ)。CLIなら下記のgcx、ブラウザならLogs Drilldown |
| アラート | Discordへの通知(AstroのエラーとGhostのERROR)も共通のGrafanaで管理する |
| 開発環境 | Grafanaは無い。`docker compose logs astro`(`make log`)で見る |

### 本番ログ調査（gcx）

本番のログは共通の Grafana（http://192.168.37.112:2008、LAN 内からのみ）で見る。調査はブラウザではなく Grafana 公式 CLI の `gcx` で Grafana の API を通して問い合わせる。

| やること | 使うもの |
|---|---|
| 接続先 | リポジトリ直下の `.gcx.yaml` がコンテキスト `shared-grafana`（Loki のデータソース UID は `loki`）を既定にする。このディレクトリで `gcx` を実行すれば自動で本番を向く |
| 認証 | サービスアカウント `gcx-local`（ロールは Viewer、見るだけ）のトークン。`~/.config/gcx/config.yaml` にだけ保存し、リポジトリには置かない |
| 初回ログイン | `make gcx-login`（`gcx login shared-grafana --server <Makefile の GRAFANA_SERVER>`）。初回だけ、自分の端末で実行してトークンを入力する（Claude Code の `!` は端末がなく入力できない） |
| 接続確認 | `make gcx-check`（`gcx config check --context shared-grafana`） |
| astro のエラーを探す | `gcx logs query '{project="usuyuki_blog_v2", service="astro"} \|~ "^(\\x1b\\[\\d+m)?error(\\x1b\\[\\d+m)?:"' --since 1h -o raw` |
| Ghost のエラーを探す | `gcx logs query '{project="usuyuki_blog_v2", service="ghost"} \|= "ERROR"' --since 1h -o raw` |
| astro のエラー件数の移り変わり | `gcx logs metrics 'sum(count_over_time({project="usuyuki_blog_v2", service="astro"} \|~ "^(\\x1b\\[\\d+m)?error(\\x1b\\[\\d+m)?:" [10m]))' --since 6h` |

- **ラベル**: ログには `job="docker"`・`service`（compose のサービス名）・`container`・`project`（compose のプロジェクト名。ブログは `usuyuki_blog_v2`）が付く。共通の Grafana には他のプロジェクトのログも入っているので、必ず `project="usuyuki_blog_v2"` で絞り込む
- **`no route to host` になる場合**: macOS のローカルネットワークの許可が、gcx を起動したアプリ（Ghostty など）から引き継がれていない。herdr のような常駐プロセスの中で動かしているときは、許可を ON にした後にその常駐プロセスを起動し直す（Apple 製の `curl` は制限を受けないので、curl で届くのに gcx で届かないときはこれを疑う）
- **エラーの判定**: ログレベルはラベルになっていないので、行の中身で判定する。astro(winston)の行は色付きの `info:` / `error:` で始まるため、行頭のレベルを正規表現で見る(`\|= "error"` だと大文字小文字を区別するうえ、本文に "error" を含む info 行まで拾ってしまう)。Ghost はレベルを大文字の `ERROR` で出す
- **保持期間**: 7 日より古いログは送られないので、それ以前の調査はできない

## Deployment Pipeline

- CI/CD runs on GitHub Actions
- Pushes to main branch trigger automated deployment
- Containers are built and pushed to ghcr.io (ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest)
- Production server pulls and deploys latest containers
- Cloudflare tunnel provides secure external access in production

## 見た目の確認とPRのスクリーンショット

### ブラウザでの確認
見た目の確認には **Claude in Chrome**(`mcp__claude-in-chrome__*`)を使う。ユーザーのChromeで開くので、ローカル(`http://localhost:1000`)と本番(`https://blog.usuyuki.net`)の両方を同じウィンドウサイズで見比べられる。

| 項目 | 内容 |
| --- | --- |
| 使うツール | Claude in Chrome。Chrome DevTools MCP(`mcp__chrome-devtools__*`)はChromeの実行ファイルが見つからず起動できない |
| ローカルの記事URL | 末尾スラッシュなし(例: `http://localhost:1000/isucon2026`) |
| スクロール | `body { scroll-behavior: smooth }` のため、`window.scrollTo` は `behavior: "instant"` を付ける。付けないとスクロール途中で撮影してしまう |
| 撮影 | `computer` の `zoom` に `save_to_disk: true` を付けて範囲を切り出す。変更前(本番)と変更後(ローカル)は同じスクロール位置・同じ範囲で撮る |
| スマホ幅 | `resize_window` はウィンドウが最大化されていると効かない。ローカルの任意のページで `document.body` を空にし、幅390pxの `<iframe>` に対象ページを読み込んで再現する(同一オリジンなのでiframe内のDOMも操作できる) |

### PRへのスクリーンショット添付
見た目に関わる変更のPRには、**変更前(本番)と変更後(ローカル)のスクリーンショットを必ず貼る**。

| 手順 | 内容 |
| --- | --- |
| 置き場所 | 画像専用ブランチ `pr-assets/<トピック名>` の `<トピック名>/` 配下(例: `pr-assets/toc-numbering` の `toc-numbering/before-title.png`) |
| ブランチの作り方 | 作業ツリーに影響しないよう、`git hash-object -w` → `git mktree` → `git commit-tree` で親を持たないコミットを作り、`git push origin "${C}:refs/heads/pr-assets/<トピック名>"` でpushする(zshでは `$C:r` が変数修飾子と解釈されるため `${C}` と書く) |
| PRでの参照 | `<img src="https://github.com/usuyuki/usuyuki_blog_v2/blob/pr-assets/<トピック名>/<トピック名>/<ファイル名>.png?raw=true" width="...">` を Before / After の表に並べる |
