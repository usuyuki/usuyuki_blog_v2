import type { DateType } from "~/types/ArticleArchiveType";
import { iso8601TimeToDate } from "./iso8601TimeToDate";

/**
 * published_at(ISO 8601文字列 or DateType)を「2026.06.18」形式に整形する
 * 不正な日付文字列の場合は空文字を返す
 */
export function formatDotDate(publishedAt: string | DateType): string {
  let date: DateType;
  if (typeof publishedAt === "string") {
    if (Number.isNaN(new Date(publishedAt).getTime())) {
      return "";
    }
    date = iso8601TimeToDate(publishedAt);
  } else {
    date = publishedAt;
  }
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}.${month}.${day}`;
}
