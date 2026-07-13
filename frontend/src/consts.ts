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

// SNS・外部プロフィールリンク(フッターなどで共用)
export const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/usuyuki26" },
  { label: "Misskey", href: "https://m5y.usuyuki.net/@usuyuki" },
  { label: "GitHub", href: "https://github.com/usuyuki" },
  { label: "ポートフォリオ", href: "https://usuyuki.net" },
] as const;
