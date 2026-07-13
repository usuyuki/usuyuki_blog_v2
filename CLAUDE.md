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
- Frontend runs on **Astro 7** (`astro@7.0.7`) with **Tailwind CSS 4** and **Svelte 5**
- **Dependency layout**: `dependencies` in `frontend/package.json` contains ONLY packages imported at runtime by the SSR bundle (`@astrojs/rss`, `@prisma/adapter-mariadb`, `@prisma/client`, `@tryghost/content-api`, `jsdom`, `sharp`, `winston`). Everything used only at build time (astro itself, adapters, integrations, tailwindcss, svelte, emoji-picker-element, etc.) lives in `devDependencies` so the production image can drop them with `pnpm prune --prod`. When adding a package, decide based on whether the built server (`dist/server`) imports it at runtime.
- Backend uses **Ghost CMS 6** as a headless CMS
- Production deployment uses Docker containers with GitHub Actions CI/CD
- **Monitoring Stack**: Grafana + Loki + Alloy for log aggregation and visualization
  - **Loki 3.5**: Log aggregation system (port 3100)
  - **Grafana 12.1**: Metrics visualization and alerting dashboard (port 1002 in dev)
  - **Alloy**: Unified telemetry collector for Docker container logs (port 12345)

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
docker pull ghost:6-alpine && docker pull cloudflare/cloudflared && docker pull mysql:8.4 && docker pull grafana/alloy:latest && docker pull ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest
docker compose -f compose-prod.yml up -d
```

## Component Architecture

The frontend follows Atomic Design principles:
- **Atom**: Basic components with no dependencies or state
- **Molecule**: Components that depend on other components
- **Organism**: Components that fetch external data or manage state

## Design System

エディトリアル(新聞・雑誌)調のデザイン。原典は `wire/` のワイヤーフレーム3枚(トップ・記事一覧・記事詳細のHTML)。

- **デザイントークン**: `frontend/src/styles/tailwind.css` の `@theme` で定義 — `--color-ink: #141414`(文字・罫線)/ `--color-paper: #ffffff`(背景)/ `--color-gray: #f4f3f0` / `--color-orange: #ff5c00`(アクセント)/ `--font-display`・`--font-en`(システムサンセリフ。Webフォントは使わない)
- **共通変数**: `frontend/src/styles/global.css` — `--bw: 2px`(基本罫線幅)/ `--max-w: 1240px`(`.container` の最大幅)/ `--article-max-width: 760px`
- **原則**: 角丸なし(`rounded-*` を使わない)、2px罫線で構造を見せる、英字見出しは900ウェイト+letter-spacing、ホバーは黒反転か下線
- **レイアウト**: `main` はフルブリード。各セクションが内側に `.container` を持つ
- **共通シェル**: `molecule/header/SiteHeader.astro`(sticky、ハンバーガー、Google検索フォーム。ナビは TOP/ALL/TAGS/ABOUT)+ `atom/footer/SiteFooter.astro`(黒ベタ+巨大タイポ。RSSリンクはフッターのSite Mapに配置)
- **記事セル**: `molecule/articleArchive/ArticleCell.astro`(+`ArticleCellGrid.astro`)をトップ/一覧/タグ/関連記事で共用。外部記事(Qiita/Zenn)はソース名バッジ付きで外部リンク
- **クライアントスクリプト**: `src/scripts/globalNav.ts`(ハンバーガー)/ `reveal.ts`(スクロール出現)/ `tocSidebar.ts`(目次スクロールスパイ)。すべて `astro:page-load` で初期化(ClientRouter対応)

## Key Files and Directories

- `frontend/src/consts.ts` - Site configuration constants(`SITE_TITLE_EN`: ヘッダー/フッター共用の英字ブランド表記、`SOCIAL_LINKS`: SNS・外部プロフィールリンクの一覧。console banner(`libs/console/snsLinkProvider.ts`)も含め表記揺れを避けるためこれらを唯一の情報源とする)
- `frontend/src/libs/ghostClient.ts` - Ghost CMS API client with retry logic and caching (posts.browse は `include: "tags"` で公開タグも変換)
- `frontend/src/libs/astroLogger.ts` - Winston-based structured logger with Loki integration
- `frontend/src/libs/articleAggregator.ts` - Unified article aggregation from Ghost, RSS feeds, and Qiita API (`getLatestArticles` / `getAllArticlesCached`(第2引数`forceRefresh`でキャッシュを無視して再取得) / `getAllGhostArticlesForArticlePage`(記事詳細用。指定slugがキャッシュに無ければ自動で強制再取得し、鮮度確認済みの全記事配列を返す) / `getAdjacentArticles`(前後記事、外部記事は除外。第2引数に`getAllGhostArticlesForArticlePage`の結果を渡す) / `getRelatedArticles`(タグベース関連記事。`options.allGhostArticles`を渡すとタグ一致・補完の両方をin-memoryで処理しGhostへのライブフェッチを回避) / `getFeaturedArticles`)
- `frontend/src/libs/helper/archiveQuery.ts` - 記事一覧のフィルター・ソート・ページネーション純関数 (`filterByYear` / `sortArticles` / `paginate` / `buildPageList` / `buildArchiveUrl`)
- `frontend/src/libs/helper/formatDotDate.ts` - `2026.06.18` 形式の日付フォーマッタ
- `frontend/src/libs/helper/articleCell.ts` - 記事セルのリンク・View Transitions名・サムネ代替・公開タグ抽出(`getPublicTags`)・画像フォールバック(`IMAGE_FALLBACK_ONERROR`)のヘルパー
- `frontend/src/libs/rssClient.ts` - RSS feed processing for external blogs (Zenn, note, etc.)
- `frontend/src/libs/qiitaClient.ts` - Qiita API v2 client with pagination and caching (full article history)
- `frontend/src/libs/config.ts` - Configuration management for external integrations
- `frontend/src/libs/errorHandler.ts` - Centralized error handling and logging
- `frontend/src/libs/cache.ts` - In-memory caching system for API responses
- `frontend/src/components/` - Astro components organized by atomic design
- `frontend/src/pages/` - Astro pages and routes (`/archive` は `?year=&sort=&page=` のSSRクエリパラメータ方式。旧 `/archive/[year]`・`/archive/[year]/[month]` は301で `/archive?year=` へリダイレクト。`/tags` はタグ一覧ページで、ヘッダーのTAGSナビのリンク先)
- `frontend/src/styles/` - CSS files including Ghost content styling (`blog/blogCommon.css` が記事本文タイポグラフィ)
- `wire/` - 新デザインのワイヤーフレーム(HTML3枚、デザインの原典)
- `compose.yml` - Development Docker configuration
- `compose-prod.yml` - Production Docker configuration

### Monitoring Configuration
- `grafana/` - Grafana configuration and dashboards
  - `grafana.ini` - Grafana server configuration
  - `dashboards/` - Pre-configured dashboards (astro-logs.json, ghost-logs.json)
  - `provisioning/` - Automated provisioning configuration
- `loki/loki-config.yml` - Loki log aggregation configuration
- `alloy/config.alloy` - Alloy telemetry collector configuration for Docker log collection

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
- `LOKI_URL` - Loki log aggregation endpoint (default: http://loki:3100)

### Monitoring Variables
- `GF_SECURITY_ADMIN_USER` - Grafana admin username (default: admin)
- `GF_SECURITY_ADMIN_PASSWORD` - Grafana admin password (default: admin)
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for error notifications
- `GRAFANA_BASE_URL` - Grafana base URL for notification links

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
- **Used by**: 記事一覧ページ・前後記事ナビ (`getAllArticlesCached`、キー `aggregated_all_articles:v2:*`), Ghost client, RSS client, Qiita API client
- **Cache Duration**: 
  - Aggregated articles: 1 hour (`ONE_HOUR_MS`)
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

### Accessing Grafana
- Development: http://localhost:1002
- Default credentials: admin/admin (configurable via environment variables)
- Pre-configured dashboards for Astro and Ghost log analysis

### Log Aggregation
- **Loki** aggregates logs from all Docker containers
- **Alloy** collects and forwards container logs to Loki (replaces deprecated Promtail)
- **astroLogger** sends structured logs to Loki via LOKI_URL environment variable
- Logs are automatically labeled with container information
- Alloy UI available at http://localhost:12345 in development

### Alert Notifications
- Discord notifications for critical errors (configure DISCORD_WEBHOOK_URL)
- Grafana alerting rules for system monitoring
- Contact points and notification policies configured in `grafana/provisioning/alerting/`

## Deployment Pipeline

- CI/CD runs on GitHub Actions
- Pushes to main branch trigger automated deployment
- Containers are built and pushed to ghcr.io (ghcr.io/usuyuki/usuyuki_blog_v2_astro:latest)
- Production server pulls and deploys latest containers
- Cloudflare tunnel provides secure external access in production