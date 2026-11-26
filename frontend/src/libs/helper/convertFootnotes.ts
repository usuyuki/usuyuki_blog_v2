import { JSDOM } from "jsdom";

// Ghostの通常エディタ(段落カード)で書ける注釈記法。
// 本文中に `((注釈の本文))` と書くと、その位置に番号付きの参照を出し、記事末尾に注釈一覧を出す。
// Markdownカードの脚注は参照と本文を同じカードに書く必要があり、通常の文章に混ぜにくいため、
// 通常のテキストの中に直接書ける専用記法にしている。

const OPEN = "((";
const CLOSE = "))";
// 注釈の記法を探す対象。見出しは目次(generateTOC)に影響するため含めない
const CANDIDATE_SELECTOR = "p, li, td, th, figcaption";

// start以降で、注釈を閉じる `))` の位置を返す。
// 注釈の本文内に `(参考)` のような括弧があっても閉じ括弧と取り違えないよう、括弧の深さを数える
const findClose = (html: string, start: number): number => {
  let depth = 0;
  for (let j = start; j < html.length; j++) {
    const ch = html[j];
    if (ch === "<") {
      const end = html.indexOf(">", j);
      if (end === -1) return -1;
      j = end;
      continue;
    }
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      if (depth > 0) {
        depth--;
      } else if (html[j + 1] === ")") {
        return j;
      }
    }
  }
  return -1;
};

const buildRef = (n: number): string =>
  `<sup class="footnote-ref"><a href="#fn-${n}" id="fnref-${n}" aria-label="注釈${n}">${n}</a></sup>`;

// 1つの要素のinnerHTMLから注釈記法を探して参照に置換する。
// タグの内側(属性値など)と<code>の中は記法とみなさない
const replaceFootnotes = (
  html: string,
  onNote: (body: string) => number,
): string => {
  let out = "";
  let codeDepth = 0;
  let i = 0;
  while (i < html.length) {
    const ch = html[i];
    if (ch === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) {
        out += html.slice(i);
        break;
      }
      const tag = html.slice(i, end + 1);
      if (/^<code[\s>]/i.test(tag)) codeDepth++;
      else if (/^<\/code>/i.test(tag)) codeDepth = Math.max(0, codeDepth - 1);
      out += tag;
      i = end + 1;
      continue;
    }
    if (codeDepth === 0 && html.startsWith(OPEN, i)) {
      const close = findClose(html, i + OPEN.length);
      if (close !== -1) {
        const body = html.slice(i + OPEN.length, close).trim();
        if (body) {
          out += buildRef(onNote(body));
          i = close + CLOSE.length;
          continue;
        }
      }
    }
    out += ch;
    i++;
  }
  return out;
};

const buildFootnoteList = (notes: string[]): string => {
  const items = notes
    .map(
      (body, index) =>
        `<li id="fn-${index + 1}"><span class="footnote-text">${body}</span> <a href="#fnref-${index + 1}" class="footnote-backref" aria-label="本文へ戻る">↩</a></li>`,
    )
    .join("");
  return `<aside class="footnotes" aria-label="注釈"><p class="footnotes-title">NOTES / 注釈</p><ol class="footnotes-list">${items}</ol></aside>`;
};

// 記事本文HTML中の `((注釈))` を番号付き参照に変換し、記事末尾に注釈一覧を追加する。
// 記法が無い記事ではjsdomを起動せずそのまま返す
export const convertFootnotes = (html: string): string => {
  if (!html.includes(OPEN)) return html;

  const dom = new JSDOM(html);
  const { document } = dom.window;
  const notes: string[] = [];

  // コードブロック内は対象外
  const candidates = Array.from(
    document.querySelectorAll(CANDIDATE_SELECTOR),
  ).filter((el) => !el.closest("pre"));

  for (const el of candidates) {
    // 入れ子のli等は、その要素自身の本文だけを処理する。
    // 子の候補要素は一時的にプレースホルダーへ退避し、後で元のノードに戻す(子側は自分の番で処理される)
    const nested = Array.from(el.children).filter(
      (child) =>
        child.matches(CANDIDATE_SELECTOR) ||
        child.querySelector(CANDIDATE_SELECTOR),
    );
    nested.forEach((child, index) => {
      const slot = document.createElement("fn-slot");
      slot.setAttribute("data-index", String(index));
      child.replaceWith(slot);
    });

    const inner = el.innerHTML;
    if (inner.includes(OPEN)) {
      el.innerHTML = replaceFootnotes(inner, (body) => {
        notes.push(body);
        return notes.length;
      });
    }

    nested.forEach((child, index) => {
      el.querySelector(`fn-slot[data-index="${index}"]`)?.replaceWith(child);
    });
  }

  if (notes.length === 0) return html;

  document.body.insertAdjacentHTML("beforeend", buildFootnoteList(notes));
  return document.body.innerHTML;
};
