/**
 * 記事本文内の全ての<a>タグを新しいタブで開くようにする
 * target="_blank" を付与し、tabnabbing対策として rel="noopener noreferrer" も付与する
 * 既にtarget/rel属性がある場合は値を上書き・マージする
 */
export const addTargetBlankToLinks = (html: string): string => {
  return html.replace(/<a\b([^>]*)>/g, (_match, attrs: string) => {
    let newAttrs = attrs.replace(/\s*target\s*=\s*("[^"]*"|'[^']*'|\S+)/i, "");

    const relMatch = newAttrs.match(
      /\s*rel\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/i,
    );
    if (relMatch) {
      const existingRel = relMatch[2] ?? relMatch[3] ?? relMatch[4] ?? "";
      const relTokens = new Set(existingRel.split(/\s+/).filter(Boolean));
      relTokens.add("noopener");
      relTokens.add("noreferrer");
      const mergedRel = Array.from(relTokens).join(" ");
      newAttrs = newAttrs.replace(relMatch[0], ` rel="${mergedRel}"`);
    } else {
      newAttrs = `${newAttrs} rel="noopener noreferrer"`;
    }

    return `<a${newAttrs} target="_blank">`;
  });
};
