import { JSDOM } from "jsdom";
import { bundledLanguages, getSingletonHighlighter } from "shiki";
import astroLogger from "~/libs/astroLogger";
import { usuyukiEditorialShikiTheme } from "./shikiTheme";

const THEME_NAME = "usuyuki-editorial";
const MERMAID_LANGUAGE = "mermaid";

// SSRリクエストのたびにWASM文法エンジンを読み込み直さないよう、
// Highlighterインスタンスをプロセス内で使い回す(getSingletonHighlighterが担保)。
const getHighlighter = () =>
  getSingletonHighlighter({
    themes: [usuyukiEditorialShikiTheme],
    langs: [],
  });

// Ghostのコードカードが出力する<pre><code class="language-XXX">を検出し、
// - language-mermaid: <pre class="mermaid">に変換し、クライアント側のmermaid.js描画に委ねる
// - それ以外の言語指定あり: Shikiでハイライト済みHTMLに置換する(SSRで完結)
// - 言語指定なし: 変換せずそのまま維持する
export const highlightCodeBlocks = async (html: string): Promise<string> => {
  if (!html.includes("language-")) return html;

  const dom = new JSDOM(html);
  const { document } = dom.window;
  const codeBlocks = Array.from(
    document.querySelectorAll("pre > code[class*='language-']"),
  );
  if (codeBlocks.length === 0) return html;

  const highlighter = await getHighlighter();

  for (const code of codeBlocks) {
    const pre = code.parentElement;
    if (!pre) continue;

    // Shikiは"c++"/"c#"/"f#"のように+/#を含む言語IDをbundledLanguagesに持つため、
    // 通常の\wでは切り詰められてしまうこれらの記号も許容する
    const langMatch = code.className.match(/language-([\w+#-]+)/);
    const lang = langMatch?.[1];
    if (!lang) continue;

    const rawCode = code.textContent ?? "";

    if (lang === MERMAID_LANGUAGE) {
      const mermaidPre = document.createElement("pre");
      mermaidPre.className = "mermaid";
      mermaidPre.textContent = rawCode;
      pre.replaceWith(mermaidPre);
      continue;
    }

    if (!(lang in bundledLanguages)) {
      // 未対応言語はハイライトせず、元のコードブロックをそのまま維持する
      continue;
    }

    try {
      await highlighter.loadLanguage(lang as keyof typeof bundledLanguages);
      const highlightedHtml = highlighter.codeToHtml(rawCode, {
        lang,
        theme: THEME_NAME,
      });
      const wrapper = document.createElement("div");
      wrapper.innerHTML = highlightedHtml;
      const highlightedPre = wrapper.firstElementChild;
      if (highlightedPre) {
        pre.replaceWith(highlightedPre);
      }
    } catch (error) {
      astroLogger.warn("Shiki highlighting failed, keeping plain code block", {
        lang,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return document.body.innerHTML;
};
