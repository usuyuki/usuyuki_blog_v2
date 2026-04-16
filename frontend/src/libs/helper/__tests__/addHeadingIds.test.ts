import { describe, expect, it } from "vitest";
import { addHeadingIds } from "../addHeadingIds";

describe("addHeadingIds", () => {
  it("id属性のない見出しにIDを付与する", () => {
    expect(addHeadingIds("<h2>Hello World</h2>")).toBe(
      '<h2 id="hello-world">Hello World</h2>',
    );
  });

  it("既にid属性がある見出しはスキップする", () => {
    const html = '<h2 id="existing">Hello</h2>';
    expect(addHeadingIds(html)).toBe(html);
  });

  it("重複するスラッグは slug-2, slug-3 の連番を付ける", () => {
    const html = "<h2>Same Title</h2><h2>Same Title</h2><h2>Same Title</h2>";
    const result = addHeadingIds(html);
    expect(result).toContain('id="same-title"');
    expect(result).toContain('id="same-title-2"');
    expect(result).toContain('id="same-title-3"');
  });

  it("日本語見出しのスラッグを生成する", () => {
    const result = addHeadingIds("<h1>テスト見出し</h1>");
    expect(result).toContain('id="テスト見出し"');
  });

  it("内部にspanタグがある見出しでもテキストからIDを生成する", () => {
    const html = '<h2><span class="marker">見出しテキスト</span></h2>';
    const result = addHeadingIds(html);
    expect(result).toContain('id="見出しテキスト"');
  });

  it("空の見出しはheading-NというフォールバックのIDを付与する", () => {
    expect(addHeadingIds("<h3></h3>")).toBe('<h3 id="heading-3"></h3>');
  });

  it("複数行にまたがる見出しを処理できる", () => {
    const html = "<h2>\n  複数行\n</h2>";
    const result = addHeadingIds(html);
    expect(result).toContain('id="複数行"');
  });

  it("h1〜h6 全レベルに対応する", () => {
    for (let i = 1; i <= 6; i++) {
      const result = addHeadingIds(`<h${i}>level${i}</h${i}>`);
      expect(result).toContain(`id="level${i}"`);
    }
  });
});
