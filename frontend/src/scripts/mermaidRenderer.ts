// 記事本文中のmermaidコードブロック(highlightCodeBlocks.tsが<pre class="mermaid">に変換したもの)を
// クライアントサイドでSVGに描画する。
// mermaidブロックを含まない記事ではmermaid.js(バンドルサイズが大きい)を読み込まないよう動的importする。
// View Transitions（ClientRouter）対応: ページ遷移のたびに再初期化する
document.addEventListener("astro:page-load", async () => {
  const mermaidBlocks = document.querySelectorAll<HTMLElement>(
    ".blog-content pre.mermaid",
  );
  if (mermaidBlocks.length === 0) return;

  const { default: mermaid } = await import("mermaid");

  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      // エディトリアルデザイン(ink/paper基調)に合わせた最小限の配色。ダークモードは無いため固定値
      background: "#ffffff",
      primaryColor: "#f4f3f0",
      primaryTextColor: "#141414",
      primaryBorderColor: "#141414",
      lineColor: "#141414",
      secondaryColor: "#ffffff",
      tertiaryColor: "#ffffff",
    },
  });

  try {
    await mermaid.run({ nodes: Array.from(mermaidBlocks) });
  } catch (error) {
    // mermaid.run()は記法エラーのある図があると最終的に例外を再スローするため、
    // 他の正常な図の描画やページ全体を巻き込まないようここで吸収する
    console.error("[mermaidRenderer] failed to render mermaid diagrams", error);
  }
});
