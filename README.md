# usuyuki_blog_v2

うすゆきブログ v2

[![PR自動ラベル付与](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/label.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/label.yml)

[![静的解析 (astro-check)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/staticAnalysis.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/staticAnalysis.yml)

[![凛としたLint](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/lint.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/lint.yml)

[![自動デプロイと初期構築](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/deploy.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/deploy.yml)

# バックエンド

Ghost CMS 6（ヘッドレス）

# フロントエンド

Astro 7 + Tailwind CSS 4 + Svelte 5

## デザイン

エディトリアル(新聞・雑誌)調のデザイン。`wire/` のワイヤーフレーム3枚(トップ・記事一覧・記事詳細)が原典。

- デザイントークン: `--color-ink: #141414` / `--color-paper: #fff` / `--color-gray: #f4f3f0` / `--color-orange: #ff5c00`(`frontend/src/styles/tailwind.css` の `@theme` で定義)
- 2px罫線(`--bw`)・角丸なし・巨大英字タイポ(Webフォントなし、システムサンセリフ)
- 記事一覧は `/archive?year=2024&sort=oldest&page=2` 形式のSSRクエリパラメータ(年別・月別アーカイブURLは301でリダイレクト)
- 記事本文のコードブロックはSSR時に[Shiki](https://shiki.style/)でシンタックスハイライト、`mermaid`言語指定のコードブロックはクライアントサイドで[mermaid.js](https://mermaid.js.org/)により図として描画([ADR-00002](./adr/00002-mermaid-and-syntax-highlight.md)参照)

## 起動順序

astro が Ghost より先に起動すると記事を取得できないまま立ち上がるため、次の2段構えで防いでいます。

| 層 | 仕組み |
|---|---|
| Docker | `ghost` の `healthcheck` が Content API の応答を確認し、`astro` は `condition: service_healthy` で待機します |
| アプリ | Ghost の取得に失敗した回の記事一覧はキャッシュせず、次のリクエストで取得し直します |

## 記事ソース

Ghost 記事に加えて、外部サービスの記事をまとめて表示できます。

| サービス | 取得方式 | 設定キー |
|---------|---------|---------|
| Qiita | API v2（全記事・ページネーション対応） | `qiitaUserId` |
| Zenn | RSS | `rssUrl` |
| note | RSS | `rssUrl` |

`EXTERNAL_BLOGS` 環境変数で設定します：

```json
[
  {"name": "Qiita", "qiitaUserId": "username", "color": "#55c500"},
  {"name": "Zenn",  "rssUrl": "https://zenn.dev/username/feed", "color": "#3ea8ff"}
]
```

## 手動キャッシュクリア

記事詳細ページに `?debug=<CACHE_CLEAR_TOKEN>` を付けてアクセスすると、全インメモリキャッシュを消去します。トークンは `.env` の `CACHE_CLEAR_TOKEN` で指定します(compose経由でastroに渡る)。未設定なら機能は無効です。

```bash
openssl rand -hex 32  # トークン生成例
```

## 絵文字リアクションの保護

| 対策 | 内容 |
|------|------|
| slug検証 | `POST/GET /api/reactions/<slug>` は `isSlug()` を満たさないslugを400で拒否 |
| 記事存在確認 | POSTは公開済みGhost記事のslugのみ受け付け、それ以外は404(記事一覧が取得できないときは503)。判定に使う一覧は5分より古ければ取り直し、Ghostへの取り直しは1分に1回までに抑える |
| レート制限 | POSTは利用者単位で1分30回まで(超過は429)。IPv6は/64単位でまとめる。保持するキーは最大1万件で、超えた分の新規キーは拒否する |
| クライアントIP | `CF-Connecting-IP` は環境変数 `TRUST_CF_CONNECTING_IP=true` のとき(本番の `compose-prod.yml` で設定)だけ信用し、それ以外は接続元アドレスを使う。IPが取れない場合はcookieのclientId単位で制限する |
| ランキング | `/reactions` はDB由来のslugをGhostのクエリに使わず、キャッシュ済みの全記事一覧から記事情報を引く。不正な形式のslugは集計から除外する |
| UI | 429・404・503などで送信に失敗したときは、楽観的更新を戻したうえで理由を表示する |

slugの検証を入れる前に保存された不正なslugの行は、以下の手順で確認・削除できます。

```bash
# 1. 対象を確認する
docker compose -f compose-prod.yml exec -T db mysql -uroot -pexample usuyuki_blog < infra/db/cleanup/select_invalid_slug_reactions.sql
# 2. 問題が無ければ削除する
docker compose -f compose-prod.yml exec -T db mysql -uroot -pexample usuyuki_blog < infra/db/cleanup/delete_invalid_slug_reactions.sql
```

## テスト

| 種別 | ツール | 実行方法 |
|------|--------|---------|
| ユニットテスト | Vitest | `docker compose exec astro pnpm test:run` |
| E2Eテスト | Playwright (chromium / firefox / webkit) | `docker compose exec -u root astro pnpm test:e2e` |

E2Eテストは `frontend/e2e/mock-ghost/` のモックGhost APIを使うため、実際のGhostバックエンドなしで動作します。CIでは `.github/workflows/e2e.yml` がPRごとに3ブラウザで表示崩れを検査します。

## コンポーネント

```mermaid
flowchart LR
  Start([Start])-->if1{外部からのデータ取得or状態を持つ?}
  if1-->|True|organism[organism]
  if1-->|False|if2{他コンポーネントへの依存がある?}
  if2-->|True|molecule[molecule]
  if2-->|False|atom[atom]
```

# デプロイ

```mermaid
graph LR
  A[main ブランチマージ] --> B[ghcr.io にコンテナをアップロード]
  B --> C[VPS 上の Docker で動かす]
```
