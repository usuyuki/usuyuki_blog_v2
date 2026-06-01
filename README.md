# usuyuki_blog_v2

うすゆきブログ v2

[![PR自動ラベル付与](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/label.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/label.yml)

[![静的解析 (astro-check)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/staticAnalysis.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/staticAnalysis.yml)

[![凛としたLint](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/lint.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/lint.yml)

[![自動デプロイと初期構築](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/deploy.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/deploy.yml)

# バックエンド

Ghost CMS 6（ヘッドレス）

# フロントエンド

Astro 5 + Tailwind CSS 4 + Svelte 5

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
