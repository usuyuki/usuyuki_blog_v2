import { describe, expect, it } from "vitest";
import { generateTOC } from "../generateTOC";

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
