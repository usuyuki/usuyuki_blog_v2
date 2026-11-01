import type { TOCType } from "~/types/TOCType";
export const generateTOC = (content: string): TOCType[] => {
  //heading系のタグの中身とidを取り出して配列にする
  const toc: TOCType[] = [];
  const headingTags = content.match(/<h[1-6] id=".*?">.*?<\/h[1-6]>/g);
  if (headingTags) {
    headingTags.forEach((tag) => {
      const id = tag.match(/id="(.*?)"/);
      const title = tag.match(/>(.*?)<\/h[1-6]>/);
      const heading = tag.match(/<h([1-6])/);
      if (id && title && heading) {
        // タグを除去してテキストのみ取得（WP記事のspan等に対応）
        const titleText = title[1].replace(/<[^>]+>/g, "").trim();
        toc.push({
          id: id[1],
          title: titleText,
          heading: parseInt(heading[1], 10),
        });
      }
    });
  }
  return toc;
};

export type NumberedTOCType = TOCType & { number: string };

/**
 * 目次の各見出しに「1」「2.1」「2.1.1」のような階層番号を振る。
 * 見出しレベルが飛んでも(h2の直下にh4など)空の階層は作らず、直前の浅い見出しの1つ下の階層として扱う。
 */
export const numberTOC = (tocList: TOCType[]): NumberedTOCType[] => {
  // 祖先から現在の階層までの見出しレベルと、その階層内での連番を積むスタック
  const stack: { heading: number; count: number }[] = [];

  return tocList.map((toc) => {
    // 今の見出しより深い階層は閉じる。閉じた階層の連番は、同じ深さに入る浅い見出しが引き継ぐ
    let popped: { heading: number; count: number } | undefined;
    while (stack.length > 0 && stack[stack.length - 1].heading > toc.heading) {
      popped = stack.pop();
    }

    const top = stack[stack.length - 1];
    if (top && top.heading === toc.heading) {
      top.count++;
    } else {
      stack.push({
        heading: toc.heading,
        count: popped ? popped.count + 1 : 1,
      });
    }

    return { ...toc, number: stack.map((level) => level.count).join(".") };
  });
};
