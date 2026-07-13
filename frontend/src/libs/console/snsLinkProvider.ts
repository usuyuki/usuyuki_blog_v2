import { SOCIAL_LINKS } from "~/consts";

// SNSごとのブランドカラー(consts.tsのSOCIAL_LINKSにないラベルはinkにフォールバック)
const BRAND_COLORS: Record<string, string> = {
  X: "#000000",
  Misskey: "#739900",
  GitHub: "#7e44c4",
  ポートフォリオ: "#141414",
};

// consts.tsのSOCIAL_LINKSを唯一の情報源として、開発者向けにコンソールへSNSリンクを出力する
export const snsLinkProvider = () => {
  const labelStyle =
    "background: black; color: white;padding: 0.25rem 0.25rem;";
  const lines: string[] = [];
  const styles: string[] = [];

  SOCIAL_LINKS.forEach((link, index) => {
    const brandColor = BRAND_COLORS[link.label] ?? "#141414";
    const prefix = index === 0 ? "" : "\n";
    const marginTop = index === 0 ? "" : "margin-top:4px;";
    lines.push(`${prefix}%c${link.label}%c${link.href}%c`);
    styles.push(
      `${marginTop}background: ${brandColor}; color: white;padding: 0.25rem 0.25rem;`,
      `${marginTop}${labelStyle}`,
      "",
    );
  });

  // console.logの結果をおしゃれに出すスタイル
  console.log(lines.join(""), ...styles);
};
