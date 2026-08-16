# ADR-00002: 記事本文のmermaid図描画とシンタックスハイライト対応

- **Status**: Accepted
- **Date**: 2026-08-09
- **Deciders**: usuyuki

---

## コンテキスト

Ghost のコードカードで書いた記事本文に、以下2点を実現したい。

1. 言語を指定したコードブロックにシンタックスハイライト（`go` なら Go の色分け等）
2. `mermaid` 言語として書いたコードブロックを図として描画

現在のスタックは以下の通り。

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Astro 7（SSR）+ Svelte 5 + Tailwind CSS 4 |
| ヘッドレス CMS | Ghost CMS 6（Content API は**読み取り専用**） |
| デザイン | エディトリアル調。角丸なし・2px罫線・ink(`#141414`)/paper(`#ffffff`)基調。ダークモード切り替えは無い |

Ghost にはプラグイン機構が無く、テーマ（Handlebars）を介した拡張が基本だが、このプロジェクトは Ghost を**ヘッドレスCMSとしてのみ**利用しており、表示は全て Astro 側が Content API 経由で取得した HTML（`post.html`）を加工して行っている。したがって Ghost のテーマ機能・Code injection は経由せず、Astro 側での対応が唯一の現実的な経路となる。

Ghost のコードカードは以下の HTML を出力する（mermaid も「その他の言語」として同様の形式で入稿可能）。

```html
<pre><code class="language-go">func main() { ... }</code></pre>
<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>
```

既に `[slug].astro` では `post.html` を SSR 時に文字列パイプラインで加工している（`addHeadingIds` → `addTargetBlankToLinks`）。この既存パターンに則った拡張を検討する。

---

## 決定ドライバー

1. **既存デザインとの統一感**: ink/paper基調のエディトリアルデザインを壊さない配色にする
2. **パフォーマンス**: シンタックスハイライトは記事閲覧のたびに毎回計算せず、可能な限りSSR/ビルド時に完結させる
3. **実装コストと既存パターンとの整合**: `[slug].astro` の既存 HTML 加工パイプライン（jsdomベースのヘルパー関数群）に沿う
4. **依存関係の分類**: `frontend/package.json` の dependencies/devDependencies 方針（SSRバンドルが実行時にimportするものだけ dependencies）を踏襲する
5. **保守性**: Ghost 側の入稿ルールをシンプルに保つ（特殊な記法を覚えさせない）

---

## 検討したオプション

### シンタックスハイライトの実現方式

#### Option A: クライアントサイドで highlight.js 等を読み込む

- **概要**: `<script>` で highlight.js を読み込み、ブラウザ側で `.language-*` を検出してハイライトする。
- **長所**
  - 実装が単純（既存のGhost HTMLに手を入れる必要がない）
- **短所**
  - JS読み込み前は無色のコードブロックが表示される（FOUC）
  - SSRで完結させたいという決定ドライバー2に反する
  - 全記事で使うコード表示のためにクライアントJSバンドルが増える

→ **FOUCとSSR方針に反するため不採用**

#### Option B: Shiki で SSR 時にハイライト済み HTML を生成（推奨）

- **概要**: `post.html` の `<pre><code class="language-XXX">` を jsdom で検出し、[Shiki](https://shiki.style/) でハイライト済みの HTML（インラインスタイル付き `<span>`）に置換してから `set:html` する。
- **長所**
  - クライアントJS不要、FOUCなし
  - VSCodeと同じTextMate文法エンジンのため対応言語が豊富（Go含む主要言語を網羅）
  - カスタムテーマを自作しink/paint基調に配色を合わせられる
- **短所**
  - SSR時（記事アクセス時）にハイライト処理のコストがかかる
  - → 既存の `getAllArticlesCached` 等と同様、記事本文キャッシュの対象に含めることで軽減可能（本ADRのスコープ外、将来の最適化とする）

→ **採用**

---

### mermaid 図の実現方式

mermaid の図は SVG 生成にブラウザの DOM/Canvas API 相当の処理を要し、Shiki のような文字列→文字列のSSR変換では完結しない。

#### Option C: サーバサイドで画像化（mermaid-cli / puppeteer等）

- **概要**: ビルド時またはSSR時に mermaid 記法から PNG/SVG を生成し `<img>` に置換する。
- **長所**
  - クライアントJS不要
- **短所**
  - `mermaid-cli` は内部で Puppeteer（Headless Chrome）に依存し、Astroコンテナのイメージサイズ・ビルド時間が大きく増える
  - 記事編集のたびに重い画像生成処理が走る

→ **コンテナサイズ・ビルド負荷の観点で不採用**

#### Option D: クライアントサイドで mermaid.js を描画（推奨）

- **概要**: SSR時は `language-mermaid` のコードブロックを `<pre class="mermaid">` のような目印付きHTMLとして出力するだけに留め、クライアント側の初期化スクリプト（`astro:page-load` で発火、既存の `globalNav.ts` 等と同じパターン）で `mermaid.js` を使い実際のSVGを描画する。
- **長所**
  - 既存のクライアントスクリプト初期化パターン（`src/scripts/*.ts` を `astro:page-load` で初期化）にそのまま乗せられる
  - mermaidブロックがある記事でのみ実質的にコストが発生する（動的import等で遅延読み込み可能）
- **短所**
  - mermaidブロックを含む記事では、描画完了までの一瞬コードテキストが見える（レイアウトシフトは `<pre>` の存在により最小限）

→ **採用**

---

## 決定

- シンタックスハイライト: **Option B（Shiki, SSR）**
- mermaid描画: **Option D（クライアントサイド mermaid.js）**

シンタックスハイライトはSSRで完結させ、mermaidのみ実行時にブラウザで描画するハイブリッド構成とする。

---

## 実装方針

### 1. パッケージ追加

```bash
docker compose exec astro pnpm add shiki
docker compose exec astro pnpm add -D mermaid
```

`shiki` はSSRバンドル（`dist/server`）が直接importするため `dependencies`。`mermaid` はクライアントバンドルにのみ含まれるため `devDependencies`（`CLAUDE.md` の依存関係分類方針に準拠）。

### 2. ファイル構成

```
frontend/src/
├── libs/helper/
│   ├── highlightCodeBlocks.ts       # 新規: pre>code.language-XXXを検出しShikiで置換 / language-mermaidは目印付きHTMLに変換する純関数
│   └── __tests__/
│       └── highlightCodeBlocks.test.ts
├── scripts/
│   └── mermaidRenderer.ts           # 新規: astro:page-loadで.mermaidブロックを検出しmermaid.jsで描画
└── pages/
    └── [slug].astro                 # processedHtmlの後段にhighlightCodeBlocksを追加
```

### 3. SSR側の処理（`highlightCodeBlocks.ts`）

`[slug].astro` の既存パイプラインに1段追加する。

```ts
const processedHtml = addTargetBlankToLinks(headingProcessedHtml);
const highlightedHtml = await highlightCodeBlocks(processedHtml);
```

処理内容:
1. jsdom で `pre > code[class*="language-"]` を全て抽出
2. `language-mermaid` の場合: `<pre class="mermaid">{生のコード文字列}</pre>` に置換（Shikiを通さない。mermaid記法はShikiのハイライト対象外）
3. それ以外: Shiki の `codeToHtml(code, { lang, theme: usuyukiEditorialTheme })` でハイライト済みHTMLに置換
4. Shikiが対応していない言語指定の場合はプレーンテキストとして処理を継続する（ビルド/記事表示を失敗させない）

### 4. Shikiカスタムテーマ

既存の `.blog-content pre`（黒背景 `--color-ink` + 白文字）に馴染むよう、ink/paper基調の最小限のカスタムテーマを自作する（`frontend/src/libs/helper/shikiTheme.ts`）。既存デザイントークン（`tailwind.css` の `@theme`）の色を流用する。

### 5. クライアント側の処理（`mermaidRenderer.ts`）

```ts
// astro:page-load で初期化。既存の globalNav.ts / reveal.ts と同じパターン
document.addEventListener("astro:page-load", async () => {
  const mermaidBlocks = document.querySelectorAll(".blog-content pre.mermaid");
  if (mermaidBlocks.length === 0) return; // mermaidを含まない記事ではmermaid.jsを読み込まない

  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: { /* ink/paper基調 */ } });
  await mermaid.run({ nodes: mermaidBlocks });
});
```

動的importにより、mermaidブロックを含まない記事ではJSバンドルがロードされない。

### 6. スタイル調整

`frontend/src/styles/blog/blogCommon.css` に、Shikiが出力するインラインスタイル済み `<pre>` と既存の `.blog-content pre` 装飾（枠線・パディング等）が競合しないよう最小限の調整を加える。mermaid描画後のSVGにも罫線調のラッパースタイルを当て、ページ全体のデザイントーンと統一する。

### 7. テスト

`CLAUDE.md` のテスト方針に従い、`highlightCodeBlocks.ts` にテーブル駆動テストを追加する。

| ケース | 入力 | 期待結果 |
|---|---|---|
| 正常系: 言語指定ありのコードブロック | `<pre><code class="language-go">...</code></pre>` | Shikiによるハイライト済みHTMLに置換される |
| 正常系: mermaidブロック | `<pre><code class="language-mermaid">graph TD;...</code></pre>` | `<pre class="mermaid">` に置換され、Shikiを通さず生コードのまま保持される |
| 正常系: 言語指定なしのコードブロック | `<pre><code>...</code></pre>` | 変換されずそのまま維持される |
| 異常系: 未対応言語を指定するとShikiが例外を投げるので、プレーンテキストとしてフォールバックする | `<pre><code class="language-nonexistent-lang">...</code></pre>` | 例外を吸収し元のコードブロックをエスケープ済みプレーンテキストとして返す |

mermaidのクライアント描画（`mermaidRenderer.ts`）はDOM操作が主体のため、Vitest + jsdom環境でのユニットテストに加え、既存のPlaywright E2E（`frontend/e2e/`）で「mermaidブロックを含む記事でSVGが描画されること」を検証するケースを追加する。

---

## 結果として生じるトレードオフ

| 項目 | 内容 |
|------|------|
| SSR処理コスト | 記事アクセスのたびにShikiのハイライト処理が走る。将来的にアクセス増で問題になれば `articleAggregator.ts` のキャッシュ機構に本文HTMLも含める最適化を検討する |
| mermaidの初期描画 | JS読み込み・実行が完了するまでmermaidブロックはコード文字列のまま表示される（レイアウトシフトは`<pre>`により最小限） |
| Ghost入稿ルール | 記事執筆者（usuyuki自身）は mermaid を書く際、コードカードの言語指定で `mermaid` を選ぶ運用ルールを覚える必要がある |
| ダークモード非対応 | サイト自体にダークモード切り替えが無いため、Shikiテーマ・mermaidテーマ共にライト固定でよい（将来ダークモードを追加する場合は本ADRの前提が変わる） |

---

## 参考

- [Shiki公式ドキュメント](https://shiki.style/)
- [mermaid.js公式ドキュメント](https://mermaid.js.org/)
- 既存のHTML加工パターン: `frontend/src/libs/helper/addHeadingIds.ts` / `frontend/src/libs/helper/addTargetBlankToLinks.ts`
- 既存のjsdom利用例: `frontend/src/libs/rssClient.ts`
- 既存のクライアントスクリプト初期化パターン: `frontend/src/scripts/globalNav.ts` / `frontend/src/scripts/reveal.ts`
- 記事本文スタイル: `frontend/src/styles/blog/blogCommon.css`
