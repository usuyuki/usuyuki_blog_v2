import type { ArticleArchiveType, DateType } from "~/types/ArticleArchiveType";
import { iso8601TimeToDate } from "./iso8601TimeToDate";

export type SortOrder = "newest" | "oldest";

export type PaginateResult<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
};

// 一覧ページの1ページあたり記事数
export const ARCHIVE_PER_PAGE = 24;

/**
 * published_atから公開年を取得する(不正な日付はnull)
 */
export function getArticleYear(publishedAt: string | DateType): number | null {
  if (typeof publishedAt === "string") {
    if (Number.isNaN(new Date(publishedAt).getTime())) {
      return null;
    }
    return iso8601TimeToDate(publishedAt).year;
  }
  return publishedAt.year;
}

/**
 * 記事一覧に存在する公開年を新しい順で重複なく返す(年別タブ用)
 */
export function listYears(articles: ArticleArchiveType[]): number[] {
  const years = new Set<number>();
  for (const article of articles) {
    const year = getArticleYear(article.published_at);
    if (year !== null) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * 指定年に公開された記事だけに絞り込む
 */
export function filterByYear(
  articles: ArticleArchiveType[],
  year: number,
): ArticleArchiveType[] {
  return articles.filter(
    (article) => getArticleYear(article.published_at) === year,
  );
}

// ソート用にpublished_atをタイムスタンプへ変換する(不正値は0)
function toTime(publishedAt: string | DateType): number {
  if (typeof publishedAt === "string") {
    const time = new Date(publishedAt).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  return new Date(
    publishedAt.year,
    publishedAt.month - 1,
    publishedAt.day,
  ).getTime();
}

/**
 * 記事を公開日順にソートした新しい配列を返す(元配列は変更しない)
 */
export function sortArticles(
  articles: ArticleArchiveType[],
  order: SortOrder,
): ArticleArchiveType[] {
  const sorted = [...articles].sort(
    (a, b) => toTime(b.published_at) - toTime(a.published_at),
  );
  return order === "oldest" ? sorted.reverse() : sorted;
}

/**
 * 配列をページ分割する。pageが範囲外の場合は1ページ目に丸める
 */
export function paginate<T>(
  items: T[],
  page: number,
  perPage: number = ARCHIVE_PER_PAGE,
): PaginateResult<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage =
    Number.isInteger(page) && page >= 1 && page <= totalPages ? page : 1;
  const start = (currentPage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    currentPage,
    totalPages,
  };
}

export type ArchiveQueryParams = {
  year?: number;
  sort?: SortOrder;
  page?: number;
};

/**
 * 一覧ページのURLを組み立てる。デフォルト値(全年・newest・1ページ目)は省略する
 */
export function buildArchiveUrl(params: ArchiveQueryParams = {}): string {
  const searchParams = new URLSearchParams();
  if (params.year !== undefined) {
    searchParams.set("year", String(params.year));
  }
  if (params.sort === "oldest") {
    searchParams.set("sort", params.sort);
  }
  if (params.page !== undefined && params.page > 1) {
    searchParams.set("page", String(params.page));
  }
  const queryString = searchParams.toString();
  return queryString ? `/archive?${queryString}` : "/archive";
}

/**
 * ページネーション表示用のページ番号リストを作る
 * 例: buildPageList(5, 11) => [1, "ellipsis", 4, 5, 6, "ellipsis", 11]
 * 総ページ数が7以下なら省略せず全ページを返す
 */
export function buildPageList(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // 先頭・末尾・現在ページの前後は常に表示する
  const visiblePages = [
    ...new Set([1, current - 1, current, current + 1, total]),
  ]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const page of visiblePages) {
    if (prev !== 0 && page - prev > 1) {
      result.push("ellipsis");
    }
    result.push(page);
    prev = page;
  }
  return result;
}
