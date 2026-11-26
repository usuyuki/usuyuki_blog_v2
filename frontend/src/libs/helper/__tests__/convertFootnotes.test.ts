// @vitest-environment node
// convertFootnotesはJSDOMを内部でimportしておりグローバルなDOMを必要としないため、node環境で実行する。
import { describe, expect, it } from "vitest";
import { convertFootnotes } from "../convertFootnotes";

describe("convertFootnotes", () => {
  it("正常系: ((注釈))を番号付き参照に置換し、記事末尾に注釈一覧を追加する", () => {
    const html = "<p>本文です((これが注釈))。続き。</p>";
    const result = convertFootnotes(html);
    expect(result).toContain(
      '<sup class="footnote-ref"><a href="#fn-1" id="fnref-1" aria-label="注釈1">1</a></sup>',
    );
    expect(result).toContain('<li id="fn-1">');
    expect(result).toContain("これが注釈");
    expect(result).toContain('href="#fnref-1"');
    expect(result).toContain("。続き。");
    expect(result).not.toContain("((");
  });

  it("正常系: 複数の注釈は文書順に連番になる", () => {
    const html = "<p>A((一つ目))</p><p>B((二つ目))C((三つ目))</p>";
    const result = convertFootnotes(html);
    expect(result.indexOf('id="fnref-1"')).toBeLessThan(
      result.indexOf('id="fnref-2"'),
    );
    expect(result).toContain('<li id="fn-3">');
    expect(result.match(/<li id="fn-\d+">/g)).toHaveLength(3);
  });

  it("正常系: 注釈内の装飾やリンクはそのまま保持される", () => {
    const html =
      '<p>文((詳しくは<a href="https://example.com">こちら</a>と<strong>太字</strong>))</p>';
    const result = convertFootnotes(html);
    expect(result).toContain('<a href="https://example.com">こちら</a>');
    expect(result).toContain("<strong>太字</strong>");
  });

  it("正常系: 注釈内の括弧は閉じ括弧と取り違えない", () => {
    const html = "<p>文((詳細(参考)を見る))続き</p>";
    const result = convertFootnotes(html);
    expect(result).toContain("詳細(参考)を見る");
    expect(result).toContain("続き");
    expect(result.match(/<li id="fn-\d+">/g)).toHaveLength(1);
  });

  it("正常系: 入れ子のリストでも文書順に番号が振られ、二重に処理されない", () => {
    const html =
      "<ul><li>親((親の注釈))<ul><li>子((子の注釈))</li></ul></li></ul>";
    const result = convertFootnotes(html);
    expect(result.match(/<li id="fn-\d+">/g)).toHaveLength(2);
    expect(result).toContain("親の注釈");
    expect(result).toContain("子の注釈");
  });

  it("正常系: 記法が無い記事はそのまま返す", () => {
    const html = "<p>注釈なしの本文(かっこ)です</p>";
    expect(convertFootnotes(html)).toBe(html);
  });

  it("エッジケース: コードブロックとインラインコード内の((は変換しない", () => {
    const html =
      "<pre><code>f((x))</code></pre><p>式は<code>g((y))</code>です</p>";
    expect(convertFootnotes(html)).toBe(html);
  });

  it("エッジケース: 属性値内の((は変換しない", () => {
    const html = '<p><a href="https://example.com/?q=((a))">リンク</a></p>';
    expect(convertFootnotes(html)).toBe(html);
  });

  it("エッジケース: 閉じていない((や空の(())は変換しない", () => {
    const html = "<p>開くだけ((閉じない</p><p>空(())です</p>";
    const result = convertFootnotes(html);
    expect(result).not.toContain("footnote-ref");
    expect(result).not.toContain("footnotes");
  });

  it("エッジケース: 見出しは対象外で目次に影響しない", () => {
    const html = '<h2 id="a">見出し((注釈))</h2>';
    expect(convertFootnotes(html)).toBe(html);
  });
});
