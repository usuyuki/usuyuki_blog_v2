import { describe, expect, it } from "vitest";
import type { TOCType } from "~/types/TOCType";
import { generateTOC, numberTOC } from "../generateTOC";

describe("generateTOC", () => {
  it("id付き見出しからTOCエントリーを生成する", () => {
    const html = '<h2 id="section1">Section 1</h2>';
    expect(generateTOC(html)).toEqual([
      { id: "section1", title: "Section 1", heading: 2 },
    ]);
  });

  it("複数の見出しを処理する", () => {
    const html = '<h1 id="title">Title</h1><h2 id="sub">Sub</h2>';
    expect(generateTOC(html)).toEqual([
      { id: "title", title: "Title", heading: 1 },
      { id: "sub", title: "Sub", heading: 2 },
    ]);
  });

  it("見出し内のspanタグを除去してテキストのみ取得する", () => {
    const html = '<h2 id="test"><span class="marker">テスト</span>見出し</h2>';
    expect(generateTOC(html)).toEqual([
      { id: "test", title: "テスト見出し", heading: 2 },
    ]);
  });

  it("idのない見出しは無視する", () => {
    expect(generateTOC("<h2>No ID</h2>")).toEqual([]);
  });

  it("空のコンテンツは空配列を返す", () => {
    expect(generateTOC("")).toEqual([]);
  });

  it("h1〜h6 全レベルを正しく取得する", () => {
    const html = [1, 2, 3, 4, 5, 6]
      .map((n) => `<h${n} id="h${n}">Heading ${n}</h${n}>`)
      .join("");
    const result = generateTOC(html);
    expect(result).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(result[i].heading).toBe(i + 1);
    }
  });
});

describe("numberTOC", () => {
  // 見出しレベルの並びだけを渡し、振られる階層番号を検証する
  const toToc = (headings: number[]): TOCType[] =>
    headings.map((heading, i) => ({ id: `h${i}`, title: `T${i}`, heading }));

  it.each([
    {
      name: "h2だけの記事は1から順に通し番号になる",
      headings: [2, 2, 2],
      expected: ["1", "2", "3"],
    },
    {
      name: "h3は直前のh2の子として2.1のように番号が振られ、次のh2で子の番号がリセットされる",
      headings: [2, 2, 3, 3, 2, 3],
      expected: ["1", "2", "2.1", "2.2", "3", "3.1"],
    },
    {
      name: "h4まで深くなると3階層の番号になる",
      headings: [2, 3, 4, 4, 3],
      expected: ["1", "1.1", "1.1.1", "1.1.2", "1.2"],
    },
    {
      // h2の直下にh4が来ても1.0.1のように空の階層を作らず、1つ下の階層として扱う
      name: "見出しレベルが飛んでも空の階層を作らない",
      headings: [2, 4, 3],
      expected: ["1", "1.1", "1.2"],
    },
    {
      // 最初がh3で始まる記事でも、後から出たh2と番号が重複しないようにする
      name: "浅い見出しが後から出ても最上位の番号は重複しない",
      headings: [3, 3, 2, 3],
      expected: ["1", "2", "3", "3.1"],
    },
    {
      name: "空の目次は空配列を返す",
      headings: [],
      expected: [],
    },
  ])("$name", ({ headings, expected }) => {
    expect(numberTOC(toToc(headings)).map((toc) => toc.number)).toEqual(
      expected,
    );
  });

  it("元の見出し情報(id・title・heading)をそのまま保持する", () => {
    expect(numberTOC([{ id: "a", title: "A", heading: 2 }])).toEqual([
      { id: "a", title: "A", heading: 2, number: "1" },
    ]);
  });
});
