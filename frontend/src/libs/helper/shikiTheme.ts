import type { ThemeRegistrationRaw } from "shiki";

// エディトリアルデザイン(--color-ink黒背景)に馴染む最小限のShikiカスタムテーマ。
// blogCommon.cssの.blog-content preが黒背景(--color-ink)+白文字(--color-ink-text)の
// 反転ブロックのため、その配色に合わせてトークンごとの色数を絞っている。
// 値はtailwind.cssの@themeで定義された--color-*トークンと合わせている。
export const usuyukiEditorialShikiTheme: ThemeRegistrationRaw = {
  name: "usuyuki-editorial",
  type: "dark",
  colors: {
    "editor.background": "#141414", // --color-ink
    "editor.foreground": "#eeeeee", // --color-ink-text
  },
  settings: [
    {
      settings: {
        foreground: "#eeeeee", // --color-ink-text
      },
    },
    {
      scope: ["comment"],
      settings: {
        foreground: "#999999", // --color-ink-muted-2
      },
    },
    {
      scope: ["string", "constant.other.symbol"],
      settings: {
        foreground: "#cccccc", // --color-ink-faint
      },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: {
        foreground: "#ff5c00", // --color-orange (アクセント)
      },
    },
    {
      scope: ["keyword", "storage", "keyword.control"],
      settings: {
        foreground: "#ff5c00", // --color-orange (アクセント)
        fontStyle: "bold",
      },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: {
        foreground: "#ffffff", // --color-paper
        fontStyle: "bold",
      },
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type"],
      settings: {
        foreground: "#aaaaaa", // --color-ink-muted
      },
    },
    {
      scope: ["variable", "variable.parameter"],
      settings: {
        foreground: "#eeeeee", // --color-ink-text
      },
    },
  ],
};
