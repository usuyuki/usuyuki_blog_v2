import { describe, expect, it } from "vitest";
import { highlightCodeBlocks } from "../highlightCodeBlocks";

describe("highlightCodeBlocks", () => {
  it("正常系: 言語指定ありのコードブロックはShikiによるハイライト済みHTMLに置換される", async () => {
    const html = '<pre><code class="language-go">func main() {}</code></pre>';
    const result = await highlightCodeBlocks(html);
    expect(result).toContain('class="shiki'); // Shikiが生成する<pre class="shiki ...">
    // Shikiはトークンごとに<span>で分割するため、内容確認は個々のトークンで行う
    expect(result).toContain(">func<");
    expect(result).toContain("main");
    expect(result).not.toBe(html);
  });

  it("正常系: mermaidブロックはpre.mermaidに置換され、Shikiを通さず生コードのまま保持される", async () => {
    const html =
      '<pre><code class="language-mermaid">graph TD;\n  A--&gt;B;</code></pre>';
    const result = await highlightCodeBlocks(html);
    expect(result).toContain('<pre class="mermaid">');
    expect(result).toContain("graph TD;");
    // mermaid.jsが記法をパースする際に解釈するのはHTML上のテキストノード内容(">")であり、
    // シリアライズ後の表記が&gt;でもブラウザDOM上ではtextContentとして">"になるため問題ない
    expect(result).toContain("A--&gt;B;");
    expect(result).not.toContain('class="shiki');
  });

  it("正常系: 言語指定なしのコードブロックは変換されずそのまま維持される", async () => {
    const html = "<pre><code>plain text</code></pre>";
    const result = await highlightCodeBlocks(html);
    expect(result).toBe(html);
  });

  it("正常系: コードブロックを含まないHTMLはそのまま維持される", async () => {
    const html = "<p>本文だけの段落</p>";
    const result = await highlightCodeBlocks(html);
    expect(result).toBe(html);
  });

  it("正常系: 複数のコードブロックをそれぞれ独立して変換する", async () => {
    const html =
      '<pre><code class="language-go">a := 1</code></pre>' +
      '<pre><code class="language-mermaid">graph TD; A--&gt;B;</code></pre>';
    const result = await highlightCodeBlocks(html);
    expect(result).toContain('class="shiki');
    expect(result).toContain('<pre class="mermaid">');
  });

  it("異常系: 未対応言語を指定するとShikiが例外を投げるので、プレーンテキストとしてフォールバックする", async () => {
    const html =
      '<pre><code class="language-nonexistent-lang">&lt;tag&gt; &amp; text</code></pre>';
    const result = await highlightCodeBlocks(html);
    // ハイライトはされないが、コード内容はエスケープされたまま保持される
    expect(result).toContain("&lt;tag&gt;");
    expect(result).not.toContain('class="shiki');
  });

  it.each([
    { lang: "c++", label: "language-c++" },
    { lang: "c#", label: "language-c#" },
    { lang: "f#", label: "language-f#" },
  ])(
    "正常系: $label のように+や#を含む言語指定でも切り詰められずShikiでハイライトされる",
    async ({ lang }) => {
      const html = `<pre><code class="language-${lang}">code</code></pre>`;
      const result = await highlightCodeBlocks(html);
      expect(result).toContain('class="shiki');
      expect(result).not.toBe(html);
    },
  );
});
