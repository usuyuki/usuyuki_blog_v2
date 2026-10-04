// 折りたたみ時の高さ: 2行(96px) + 上下バッファ py-2(16px) = 112px
const COLLAPSED_MAX_HEIGHT = "7rem";

// サイドバー展開時の高さ: 配置側(記事詳細ページのサイドバー)が --reaction-list-max-height で渡す上限。
// 未指定なら4行分(13rem ≈ 208px)。画面が極端に低くても1行分(3.5rem)は確保する
const SIDEBAR_MAX_HEIGHT =
  "max(var(--reaction-list-max-height, 13rem), 3.5rem)";

/**
 * リアクション一覧の max-height を返す(styleにそのまま渡す値。undefinedなら上限なし)
 * - サイドバー(scrollable)では折りたたみ時も配置側の上限を超えないようにする。
 *   超えると sticky のサイドバーが画面より高くなり、➕ボタンが画面外に押し出されるため
 * - サイドバー以外(スマホなど)は折りたたみ時の2行分のみ制限し、展開時は全件表示する
 */
export function getReactionListMaxHeight(
  collapsed: boolean,
  scrollable: boolean,
): string | undefined {
  if (scrollable) {
    return collapsed
      ? `min(${COLLAPSED_MAX_HEIGHT}, ${SIDEBAR_MAX_HEIGHT})`
      : SIDEBAR_MAX_HEIGHT;
  }
  return collapsed ? COLLAPSED_MAX_HEIGHT : undefined;
}
