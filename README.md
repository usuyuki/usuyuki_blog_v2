# usuyuki_blog_v2

うすゆきブログ v2

[![PR自動ラベル付与](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/label.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/label.yml)

[![静的解析 (astro-check)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/staticAnalysis.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/staticAnalysis.yml)

[![凛としたLint](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/lint.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/lint.yml)

[![自動デプロイと初期構築](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/deploy.yml/badge.svg)](https://github.com/usuyuki/usuyuki_blog_v2/actions/workflows/deploy.yml)

# バックエンド

Ghost

# フロントエンド

Astro

## コンポーネント

```mermaid
flowchart LR
  Start([Start])-->if1{状態を持つ?}
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
