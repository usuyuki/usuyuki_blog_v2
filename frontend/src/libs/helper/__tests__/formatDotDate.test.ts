import { describe, it, expect } from "vitest";
import type { DateType } from "~/types/ArticleArchiveType";
import { formatDotDate } from "../formatDotDate";

describe("formatDotDate", () => {
  const cases: {
    name: string;
    input: string | DateType;
    expected: string;
  }[] = [
    {
      name: "正常系: ISO 8601文字列を渡すとYYYY.MM.DD形式になる",
      input: "2026-06-18T10:00:00.000+09:00",
      expected: "2026.06.18",
    },
    {
      name: "正常系: 1桁の月日はゼロ埋めされる",
      input: "2023-01-05T12:00:00.000Z",
      expected: "2023.01.05",
    },
    {
      name: "正常系: DateTypeオブジェクトを渡すとYYYY.MM.DD形式になる",
      input: { year: 2024, month: 4, day: 21 },
      expected: "2024.04.21",
    },
    {
      name: "正常系: DateTypeの2桁月日はそのまま表示される",
      input: { year: 2022, month: 12, day: 31 },
      expected: "2022.12.31",
    },
    {
      name: "異常系: 不正な日付文字列を入れるとDateがNaNになるので空文字を返す",
      input: "invalid-date",
      expected: "",
    },
    {
      name: "異常系: 空文字を入れると日付として解釈できないので空文字を返す",
      input: "",
      expected: "",
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(formatDotDate(input)).toBe(expected);
  });
});
