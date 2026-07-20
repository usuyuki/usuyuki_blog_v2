// E2Eテスト用のGhost Content API固定データ。
// 実際のGhostを起動せずに決定的なレスポンスを返すためのfixture。
// 記事のslug・タグ・日付はe2eのspecファイルから参照されるため、変更時は両方を更新すること。

const TAG_TECH = {
  id: "tag-tech",
  name: "技術",
  slug: "tech",
  description: "技術系の記事",
  visibility: "public",
  url: "https://blog.usuyuki.net/tags/tech/",
  count: { posts: 6 },
};

const TAG_LIFE = {
  id: "tag-life",
  name: "生活",
  slug: "life",
  description: "生活系の記事",
  visibility: "public",
  url: "https://blog.usuyuki.net/tags/life/",
  count: { posts: 6 },
};

// 内部タグ(#はじまり)は画面に表示されないことの確認用
const TAG_INTERNAL = {
  id: "tag-internal",
  name: "#internal",
  slug: "hash-internal",
  description: "内部タグ",
  visibility: "internal",
  url: "https://blog.usuyuki.net/tags/hash-internal/",
  count: { posts: 12 },
};

export const tags = [TAG_TECH, TAG_LIFE, TAG_INTERNAL];

// 記事一覧・ヒーロー・ピックアップ・年別アーカイブが埋まるよう、
// 2024〜2026年に分散した12記事を用意する
const RICH_HTML = `
<p>これはE2Eテスト用の記事本文です。レイアウト崩れの検出に使います。</p>
<h2 id="section-1">最初の見出し</h2>
<p>目次(TOC)生成の確認用の段落です。<a href="https://example.com/">外部リンク</a>も含みます。</p>
<h2 id="section-2">次の見出し</h2>
<ul><li>リスト項目1</li><li>リスト項目2</li></ul>
<p>長めの文章もいれておきます。急須で入れたようななにかを綴っていくブログのテストです。</p>
`;

function buildPost(n, { year, month, featured, tags: postTags }) {
  const date = `${year}-${String(month).padStart(2, "0")}-15T09:00:00.000+09:00`;
  return {
    id: `post-${n}`,
    uuid: `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`,
    title: `E2Eテスト用記事${n}`,
    slug: `e2e-post-${n}`,
    html: n === 1 ? RICH_HTML : `<p>E2Eテスト用記事${n}の本文です。</p>`,
    excerpt: `E2Eテスト用記事${n}の概要文です。`,
    feature_image: null,
    featured,
    visibility: "public",
    created_at: date,
    updated_at: date,
    published_at: date,
    reading_time: 3,
    tags: postTags,
    primary_tag: postTags[0] ?? null,
    url: `https://blog.usuyuki.net/e2e-post-${n}/`,
  };
}

// 新しい順: post-1が最新。奇数=tech、偶数=life。3の倍数はfeatured(ピックアップ用)
export const posts = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  // 4記事ごとに年をずらす(2026年4件、2025年4件、2024年4件)
  const year = 2026 - Math.floor(i / 4);
  const month = 12 - (i % 4) * 3;
  return buildPost(n, {
    year,
    month,
    featured: n % 3 === 0,
    tags: [n % 2 === 1 ? TAG_TECH : TAG_LIFE, TAG_INTERNAL],
  });
});
