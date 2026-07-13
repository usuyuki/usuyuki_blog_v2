import type {
  ArticleArchiveType,
  ArticleTagType,
} from "~/types/ArticleArchiveType";

// Ghost APIのtags配列に入りうる最小限の形(visibility/name/slugのみ使用)
type GhostTagLike = {
  visibility?: string | null;
  name?: string | null;
  slug?: string | null;
};

/**
 * Ghost記事のtagsから公開タグ(visibility: "public")だけを抽出し、
 * {name, slug} の形に正規化して返す。tags未指定時は空配列。
 */
export function getPublicTags(
  tags: GhostTagLike[] | null | undefined,
): ArticleTagType[] {
  return (tags ?? [])
    .filter((tag) => tag.visibility === "public")
    .map((tag) => ({ name: tag.name || "", slug: tag.slug || "" }));
}

/**
 * 記事セルのリンク先を返す(内部記事は/slug、外部記事はexternalUrl)
 */
export function articleHref(
  article: Pick<ArticleArchiveType, "slug" | "isExternal" | "externalUrl">,
): string {
  if (article.isExternal) {
    return article.externalUrl ?? article.slug;
  }
  return `/${article.slug}`;
}

/**
 * View Transitions名に使うslugを返す
 * 内部記事は記事ページと名前を一致させるためそのまま、
 * 外部記事はURLがslugに入っており不正な文字を含むため安全な文字へ置換する
 */
export function viewTransitionSlug(
  article: Pick<ArticleArchiveType, "slug" | "isExternal">,
): string {
  if (article.isExternal) {
    return article.slug.replace(/[^a-zA-Z0-9_-]/g, "-");
  }
  return article.slug;
}

// サムネイルがない記事の代替グラデーション一覧
const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(120deg, #f1efec, #d4d0ca)",
  "linear-gradient(120deg, #faf9f7, #c8c4be)",
  "linear-gradient(120deg, #ebe9e5, #a7a29b)",
  "linear-gradient(120deg, #f6f4f1, #beb9b3)",
  "linear-gradient(120deg, #e6e3de, #99948d)",
] as const;

/**
 * サムネイルがない記事の代替グラデーションをslugから決定的に返す
 */
export function thumbGradient(slug: string): string {
  return PLACEHOLDER_GRADIENTS[slug.length % PLACEHOLDER_GRADIENTS.length];
}

/**
 * 外部記事のソースバッジ背景色を返す(hex指定のみ有効、それ以外はink)
 */
export function sourceBadgeBackground(sourceColor?: string): string {
  if (sourceColor?.startsWith("#")) {
    return sourceColor;
  }
  return "var(--color-ink)";
}

/**
 * 画像読み込み失敗時のonerrorハンドラ文字列。
 * imgタグの直後の要素(プレースホルダーdiv)を表示に切り替える。
 * ArticleCell.astro/HeroSection.astroで共用し、実装のドリフトを防ぐ。
 * 前提: imgタグの直後のsibling要素がプレースホルダーであること。
 */
export const IMAGE_FALLBACK_ONERROR =
  "this.style.display='none';this.nextElementSibling.style.display='block'";
