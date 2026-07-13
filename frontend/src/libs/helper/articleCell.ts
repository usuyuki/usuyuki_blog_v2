import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

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
