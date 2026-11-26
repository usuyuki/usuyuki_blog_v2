import { describe, expect, it } from "vitest";
import { checkDevPageAccess, isDevPagePath } from "../devPageAuth";

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("isDevPagePath", () => {
  it.each([
    // /dev配下はすべて対象(今後プレビューページを増やしても自動で保護される)
    { pathname: "/dev", expected: true },
    { pathname: "/dev/", expected: true },
    { pathname: "/dev/chart-preview", expected: true },
    // 「dev」で始まる記事slugを巻き込まない
    { pathname: "/devops-tips", expected: false },
    { pathname: "/", expected: false },
    { pathname: "/api/dev", expected: false },
  ])("正常系: $pathname は対象かどうか$expected", ({ pathname, expected }) => {
    expect(isDevPagePath(pathname)).toBe(expected);
  });
});

describe("checkDevPageAccess", () => {
  const credentials = { user: "usuyuki", password: "secret" };

  it.each([
    {
      name: "正常系: 認証を無効にした環境(開発用のcompose.yml)では認証なしで表示する",
      input: {
        authDisabled: true,
        authorization: null,
        credentials: undefined,
      },
      expected: "allow",
    },
    {
      name: "正常系: 本番で正しいユーザー名とパスワードを送ると表示する",
      input: {
        authDisabled: false,
        authorization: basic("usuyuki", "secret"),
        credentials,
      },
      expected: "allow",
    },
    {
      name: "正常系: パスワードに:を含んでも、最初の:でユーザー名と分けて照合する",
      input: {
        authDisabled: false,
        authorization: basic("usuyuki", "se:cret"),
        credentials: { user: "usuyuki", password: "se:cret" },
      },
      expected: "allow",
    },
    {
      name: "異常系: 認証を無効にしておらず認証情報の環境変数も未設定だと、公開しないので404になる",
      input: {
        authDisabled: false,
        authorization: basic("usuyuki", "secret"),
        credentials: undefined,
      },
      expected: "not_found",
    },
    {
      name: "異常系: 本番でAuthorizationヘッダーが無いと、ブラウザに入力を促すため401になる",
      input: { authDisabled: false, authorization: null, credentials },
      expected: "unauthorized",
    },
    {
      name: "異常系: 本番でパスワードを間違えると認証できないので401になる",
      input: {
        authDisabled: false,
        authorization: basic("usuyuki", "wrong"),
        credentials,
      },
      expected: "unauthorized",
    },
    {
      name: "異常系: 本番でユーザー名を間違えると認証できないので401になる",
      input: {
        authDisabled: false,
        authorization: basic("someone", "secret"),
        credentials,
      },
      expected: "unauthorized",
    },
    {
      name: "異常系: 本番でBasic以外の方式を送るとBasic認証として読めないので401になる",
      input: {
        authDisabled: false,
        authorization: "Bearer token",
        credentials,
      },
      expected: "unauthorized",
    },
  ])("$name", ({ input, expected }) => {
    expect(checkDevPageAccess(input)).toBe(expected);
  });
});
