// ClientRouter (View Transitions) の astro:before-preparation / astro:before-swap で
// 「同一ページ内のハッシュ違いのみのブラウザバック/フォワード」を判定する。
//
// 背景: tocSidebar.ts は目次タップ時に history.pushState でハッシュを積む。
// この状態からブラウザバック(モバイルのスワイプバックジェスチャーを含む)すると、
// ClientRouterがpopstateを「見覚えのないページ遷移」として扱い、ページ全体を
// フェッチ・差し替えしてしまい、記事を読んでいる途中で前のページへ
// 強制的に戻されたように見える不具合がある。
// 遷移元・遷移先が同一パス+検索パラメータ(ハッシュ違いのみ)のtraverseナビゲーションは
// ページ内ハッシュ移動でしかないため、この関数がtrueを返す場合はローダー/DOM差し替えを
// no-opにして無視する。
// 参考: https://github.com/withastro/astro/issues/13943
export function isSamePageTraverse(
  from: URL,
  to: URL,
  navigationType: string,
): boolean {
  return (
    navigationType === "traverse" &&
    from.pathname === to.pathname &&
    from.search === to.search
  );
}
