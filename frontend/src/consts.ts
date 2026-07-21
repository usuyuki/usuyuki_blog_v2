// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "うすゆきブログ";
// ヘッダー・フッターの英字ブランド表記で共用する(表記揺れ防止のため定数化)
export const SITE_TITLE_EN = "Usuyuki Blog";
export const SITE_URL = "https://blog.usuyuki.net";
export const SITE_AUTHOR = "うすゆき";
export const TWITTER_ID = "@usuyuki26";
export const SITE_SUB_TITLE = "急須で入れたような何か";
export const SITE_DESCRIPTION = "うすゆきのブログです";

// Google Analytics
export const GA_MEASUREMENT_ID = "G-ZB2SYBTNQQ";

// 固定OGP画像(images/ogp/ogp.png)のURLと実寸。og:image/width/heightに使う。
// トップ・404・タグ一覧など固定画像を使う全ページ、および記事詳細でfeature_imageが
// 無い場合のフォールバックで共用する
export const DEFAULT_OGP_IMAGE_WIDTH = 1200;
export const DEFAULT_OGP_IMAGE_HEIGHT = 630;
export const DEFAULT_OGP_IMAGE_URL = `${SITE_URL}/images/ogp/ogp.png`;

// SNS・外部プロフィールリンク(フッターなどで共用)
export const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/usuyuki26" },
  { label: "Misskey", href: "https://m5y.usuyuki.net/@usuyuki" },
  { label: "GitHub", href: "https://github.com/usuyuki" },
  { label: "ポートフォリオ", href: "https://usuyuki.net" },
] as const;
