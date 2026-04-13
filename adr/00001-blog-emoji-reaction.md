# ADR-00001: ブログ絵文字リアクション機能の実装

- **Status**: Proposed
- **Date**: 2026-04-13
- **Deciders**: usuyuki

---

## コンテキスト

ブログ記事に対してユーザが絵文字でリアクションをつけられる機能を追加したい。  
現在のスタックは以下の通り。

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Astro 5 (SSR) + Svelte 5 + Tailwind CSS 4 |
| ヘッドレス CMS | Ghost CMS 6（Content API は**読み取り専用**） |
| DB | MySQL 8.4（`db` コンテナ。現在は Ghost 専用スキーマのみ） |
| インフラ | Docker Compose、本番は Cloudflare Tunnel 経由 |
| キャッシュ | Astroコンテナ内のインメモリキャッシュ（TTL あり） |

Ghost Content API は読み取り専用であり、リアクションデータの永続化には別の仕組みが必要。  
個人ブログのため、スケールアウト（Astroコンテナ複数台）は当面不要。

---

## 決定ドライバー

1. **永続化**: コンテナ再起動後もリアクション数が消えないこと
2. **集計表示**: 記事ごとの絵文字別カウントを全ユーザに表示できること
3. **スパム耐性**: 同一ユーザによる無限連打を抑制できること
4. **追加インフラの最小化**: 新サービス・外部依存を増やしすぎない
5. **実装コスト**: 既存のコードパターンに沿って実装できること

---

## 検討したオプション

### Option A: クライアントサイドのみ（localStorage）

- **概要**: リアクション済みフラグをブラウザの localStorage に保存する。バックエンド不要。
- **長所**
  - 実装が最も簡単
  - サーバ負荷ゼロ
- **短所**
  - リアクション数の**集計が不可能**（他ユーザの数が見えない）
  - ブラウザ固有のため、別端末・シークレットモードでリセットされる

→ **集計表示の要件を満たせないため不採用**

---

### Option B: Astro APIエンドポイント + SQLite

- **概要**: Astroコンテナ内で `better-sqlite3` を使用し、SQLiteファイルを Docker ボリュームに永続化する。
- **長所**
  - 新規コンテナ・外部サービス不要
- **短所**
  - `better-sqlite3` はネイティブモジュールのため Docker イメージのビルド設定が複雑になる
  - Astroコンテナを複数台にスケールした場合、コンテナごとに別のSQLiteを持つことになる
  - 既存の MySQL が動いているにもかかわらず別のストレージを追加する冗長さがある

→ **既存 MySQL を活用できるため不採用**

---

### Option C: 外部マネージドサービス（Upstash Redis）

- **概要**: Upstash の Serverless Redis（HTTP API）を使用する。
- **長所**
  - 永続化・スケールをマネージドサービスが担う
- **短所**
  - 外部サービス依存が増える（障害時にリアクション機能が全停止）
  - `client_id` の重複排除を自前で実装する必要がある
  - 環境変数の追加管理が必要

→ **外部依存増・実装コストの観点で不採用**

---

### Option D: MySQL を使う（推奨）

Astroコンテナから `mysql2`（Pure JavaScript）で MySQL に接続し、Astro の `/api/reactions/[slug]` エンドポイントで GET/POST を処理する。  
ネイティブモジュール不要、スケールアウト時も一貫性が保たれる点が SQLite より優れる。

スキーマ・テーブル定義は共通。

```sql
CREATE DATABASE IF NOT EXISTS reactions
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reactions;

CREATE TABLE IF NOT EXISTS emoji_reactions (
  id         BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  slug       VARCHAR(255)     NOT NULL,
  emoji      VARCHAR(10)      NOT NULL,
  client_id  VARCHAR(36)      NOT NULL,
  created_at DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reaction (slug, emoji, client_id),
  INDEX      idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- **API 設計**

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/reactions/[slug]` | 絵文字別カウントと自分のリアクション状態を返す |
| POST | `/api/reactions/[slug]` | リアクション追加・取り消し（トグル） |

- **スパム対策**: `UNIQUE KEY (slug, emoji, client_id)` によりDB側で重複を排除する。POST はトグル動作（すでにリアクション済みなら DELETE、未リアクションなら INSERT）。

MySQL をどのコンテナで運用するかで2案に分かれる。

#### Option D-1: 既存 `db` コンテナに `reactions` スキーマを追加

```
db コンテナ（MySQL 8.4）
├── ghost      ← 既存（Ghost CMS 用）
└── reactions  ← 新規追加（リアクション用）
```

- **長所**
  - 新規コンテナ不要（`db` コンテナはすでに稼働中）
  - `db-store` ボリュームがすでに永続化設定済みのため、追加ボリューム不要
- **短所**
  - Ghost と同一 MySQL インスタンスを共有するため、DBサーバ障害時に Ghost・リアクション両方が影響を受ける
  - 将来 Ghost の MySQL バージョンアップ等の際に reactions への影響を考慮する必要がある
  - Astroコンテナが `db` コンテナに直接依存する（`depends_on: db` の追加が必要）

#### Option D-2: リアクション専用の MySQL コンテナを追加（推奨）

```
db コンテナ（MySQL 8.4）    ← Ghost 専用（変更なし）
reactions-db コンテナ（MySQL 8.4）  ← リアクション専用（新規）
```

```yaml
# compose.yml に追記
services:
  reactions-db:
    image: mysql:8.4
    volumes:
      - reactions-db-store:/var/lib/mysql
      - ./infra/db/reactions-init:/docker-entrypoint-initdb.d
    environment:
      MYSQL_ROOT_PASSWORD: example
      MYSQL_DATABASE: reactions

volumes:
  reactions-db-store:
```

- **長所**
  - Ghost の DB と完全分離。Ghost の障害・メンテナンスがリアクション機能に波及しない
  - reactions-db のスキーマ・バージョン管理を Ghost と独立して行える
  - 将来リアクション DB だけバックアップ・移行・スケールする際に容易
- **短所**
  - コンテナが1つ増える（`db` と `reactions-db` の2つの MySQL を管理する）
  - ボリュームも1つ増える

---

### Option E: 新規サービスコンテナ（Node.js + PostgreSQL）

- **概要**: Docker Compose に独立した reactions API サービスと PostgreSQL を追加する。
- **長所**
  - 最も堅牢でスケーラブル
- **短所**
  - 個人ブログの規模に対してオーバーエンジニアリング
  - 管理するコンテナが2つ増える

→ **規模感に見合わないため不採用**

---

## 決定: **Option D-1（既存 `db` コンテナに `reactions` データベースを追加）**

コンテナは既存の `db` を共用するが、データベース（スキーマ）は `ghost` と `reactions` に分離する。  
新規コンテナ不要でシンプルさを保ちつつ、スキーマレベルで Ghost のデータと完全に分離できる。

---

## 実装方針

### 1. パッケージ追加

```bash
docker compose exec astro pnpm add mysql2
```

### 2. Docker Compose の `astro` サービスに環境変数追加

新規コンテナは不要。`astro` サービスに接続情報を追加し、`depends_on: db` を明示するだけでよい。

```yaml
# compose.yml / compose-prod.yml の astro サービスに追記
services:
  astro:
    environment:
      REACTIONS_DB_HOST: db
      REACTIONS_DB_USER: root
      REACTIONS_DB_PASSWORD: example
      REACTIONS_DB_NAME: reactions
    depends_on:
      - db  # 追加
```

### 3. DB 初期化スクリプト

`db` コンテナ初回起動時に自動実行される init SQL を追加する。  
`docker-entrypoint-initdb.d` はボリューム（`db-store`）が空のとき（初回のみ）実行される。

```yaml
# compose.yml の db サービスに追記
services:
  db:
    volumes:
      - db-store:/var/lib/mysql
      - ./infra/db/reactions-init:/docker-entrypoint-initdb.d  # 追加
```

```sql
-- infra/db/reactions-init/01_schema.sql
CREATE DATABASE IF NOT EXISTS reactions
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reactions;

CREATE TABLE IF NOT EXISTS emoji_reactions (
  id         BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  slug       VARCHAR(255)     NOT NULL,
  emoji      VARCHAR(10)      NOT NULL,
  client_id  VARCHAR(36)      NOT NULL,
  created_at DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reaction (slug, emoji, client_id),
  INDEX      idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4. ファイル構成

```
frontend/src/
├── libs/
│   └── reactionClient.ts          # MySQL 接続・CRUD
├── pages/api/
│   └── reactions/
│       └── [slug].ts              # GET / POST エンドポイント
└── components/
    └── organism/article/
        └── EmojiReaction.svelte   # リアクション UI（Svelte）

infra/db/reactions-init/
└── 01_schema.sql                  # reactions DB 初期化スクリプト
```

### 5. 対応絵文字

NSFW な絵文字を除き、任意の絵文字をリアクションとして使用できる。

#### 絵文字の入力方法

UI にはブラウザネイティブの絵文字ピッカー（`inputmode` 属性や `<input type="text">` + OS の絵文字キーボード）ではなく、  
軽量な絵文字ピッカーライブラリ（例: `emoji-mart`）を Svelte コンポーネントに組み込む。

#### NSFW フィルタリング

- **クライアントサイド**: 絵文字ピッカーライブラリ側でカテゴリ制限（`Smileys & People` 等のみ許可、または `Symbols` 内の性的表現カテゴリを除外）
- **サーバサイド（POST エンドポイント）**: 受け取った文字列が Unicode 絵文字として正規表現で有効かをバリデーションし、ブロックリストに含まれる絵文字は 400 を返す

ブロックリスト管理は `frontend/src/libs/reactionClient.ts` 内に定数として保持する。

#### DB への影響

`emoji` カラムは `VARCHAR(10) CHARACTER SET utf8mb4` のため、複合絵文字（例: 家族絵文字 👨‍👩‍👧 など複数コードポイントの結合）も格納できる。  
ただし表示崩れを防ぐため、POST 時にコードポイント数の上限（例: 8 コードポイント以内）をサーバサイドでバリデーションする。

#### 表示方法

同一記事に対してユーザが投稿した絵文字をカウント順に並べて表示する。  
カウントが多い絵文字ほど前に表示し、上限件数（例: 最大20種）を超えた場合は件数の少ないものを非表示にする。

### 6. クライアント識別

- 初回アクセス時にサーバサイドで UUID v4 を生成し、`HttpOnly` Cookie（`reaction_client_id`）として1年間保持する
- Cookie が存在する場合はそれを再利用する

### 7. スパム対策

- `UNIQUE KEY (slug, emoji, client_id)` により同一ユーザの同一絵文字への重複リアクションをDB側で排除する
- POST はトグル動作（すでにリアクション済みなら DELETE、未リアクションなら INSERT）

### 8. フロントエンドのユーザ体験

#### 配置

`[slug].astro` のタイトル・サムネイル・タグ一覧の直後、記事本文（`<article>`）の直前に配置する。  
ページを開いた時点でリアクションが目に入り、記事を読む前から他のユーザの反応を確認できる。

```
[サムネイル・タイトル・日付]
[タグ一覧]
─────────────────
  👍 12  ❤️ 5  😂 3  😮 1  🎉 8   ← EmojiReaction コンポーネント
─────────────────
[記事本文]
```

#### 初期表示

- ページ読み込み時に GET `/api/reactions/[slug]` を呼び出し、絵文字別カウントと自分のリアクション済み状態を取得する
- 自分がリアクション済みの絵文字はハイライト表示（背景色を変える等）で区別する
- 絵文字はカウント降順で表示し、まだ誰もリアクションしていない場合は「最初にリアクションしよう」等のプレースホルダーを表示する
- 絵文字ピッカーを開くボタン（➕ や 😊 等）を末尾に配置し、任意の絵文字を追加できることを示す

#### クリック時のインタラクション

- **楽観的UI更新**: POST のレスポンスを待たず、クリック直後にカウントとハイライトをローカルで更新する。APIが失敗した場合は元の状態に戻す
- **アニメーション**: クリック時に絵文字をわずかに拡大・縮小するバウンスアニメーションをつける
- **連打抑制**: クリック中（POST 中）はボタンを無効化し、二重送信を防ぐ

#### エラー時

- API 失敗時は楽観的更新を元に戻す。エラーメッセージはユーザに表示しない（静かに失敗する）
- ネットワーク断などでリアクションが記録できなかった場合も、UI を元の状態に戻すだけで十分

#### アクセシビリティ

- 各絵文字ボタンに `aria-label`（例: `aria-label="いいね 12件"`）を付与する
- `aria-pressed` でリアクション済み状態をスクリーンリーダーに伝える
- キーボード操作（Tab + Enter/Space）でリアクション可能にする

#### モバイル対応

- ボタンのタップ領域を十分に確保する（最低 44×44px）
- 絵文字が多くなっても折り返して表示し、ピッカーボタンは常に末尾に固定する

---

## 結果として生じるトレードオフ

| 項目 | 内容 |
|------|------|
| Ghost との MySQL 共有 | 同一 MySQL インスタンスのため、DBサーバ障害時に Ghost とリアクション両方が影響を受ける。データベースは分離されているため通常運用での干渉はない |
| init スクリプトの制約 | `docker-entrypoint-initdb.d` は `db-store` ボリュームが空のとき（初回のみ）実行される。既存環境への適用は手動で `CREATE DATABASE` を実行する必要がある |
| Cookie 依存 | `HttpOnly` Cookie を使うため、Cookie を削除するとリアクション状態がリセットされる |
| 本番環境対応 | `compose-prod.yml` の `astro` サービスにも環境変数と `depends_on: db` の追加が必要 |

---

## 参考

- [mysql2 ドキュメント](https://sidorares.github.io/node-mysql2/docs)
- 既存の Astro API エンドポイント実装: `frontend/src/pages/api/archive.ts`
- 既存のキャッシュ実装: `frontend/src/libs/cache.ts`
- Docker Compose DB 設定: `compose.yml` の `db` サービス
