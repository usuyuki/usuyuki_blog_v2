import { describe, expect, it } from "vitest";
import { addTargetBlankToLinks } from "../addTargetBlankToLinks";

describe("addTargetBlankToLinks", () => {
  it("target属性のないaタグにtarget=_blankとrelを付与する", () => {
    const html = '<a href="https://example.com">link</a>';
    expect(addTargetBlankToLinks(html)).toBe(
      '<a href="https://example.com" rel="noopener noreferrer" target="_blank">link</a>',
    );
  });

  it("既にtarget属性がある場合は_blankに上書きする", () => {
    const html = '<a href="https://example.com" target="_self">link</a>';
    const result = addTargetBlankToLinks(html);
    expect(result).toContain('target="_blank"');
    expect(result).not.toContain('target="_self"');
  });

  it("既にrel属性がある場合はnoopener noreferrerをマージする", () => {
    const html = '<a href="https://example.com" rel="nofollow">link</a>';
    const result = addTargetBlankToLinks(html);
    expect(result).toContain("nofollow");
    expect(result).toContain("noopener");
    expect(result).toContain("noreferrer");
  });

  it("同じrelトークンが重複して付与されない", () => {
    const html = '<a href="https://example.com" rel="noopener">link</a>';
    const result = addTargetBlankToLinks(html);
    const relMatch = result.match(/rel="([^"]*)"/);
    const tokens = relMatch?.[1].split(" ") ?? [];
    expect(tokens.filter((t) => t === "noopener")).toHaveLength(1);
  });

  it("複数のaタグをすべて処理する", () => {
    const html = '<a href="/a">A</a><p>text</p><a href="/b">B</a>';
    const result = addTargetBlankToLinks(html);
    expect(result.match(/target="_blank"/g)).toHaveLength(2);
  });

  it("aタグがない場合は元のHTMLをそのまま返す", () => {
    const html = "<p>no links here</p>";
    expect(addTargetBlankToLinks(html)).toBe(html);
  });

  it("id属性など他の属性を保持する", () => {
    const html = '<a id="foo" class="bar" href="/c">link</a>';
    const result = addTargetBlankToLinks(html);
    expect(result).toContain('id="foo"');
    expect(result).toContain('class="bar"');
    expect(result).toContain('href="/c"');
  });

  it("シングルクォート属性値のtarget属性も上書きできる", () => {
    const html = "<a href='/d' target='_self'>link</a>";
    const result = addTargetBlankToLinks(html);
    expect(result).toContain('target="_blank"');
    expect(result).not.toContain("_self");
  });
});
