// /dev配下(グラフのプレビューなど、執筆者だけが使うページ)へのアクセス可否を判定する。
// 開発環境(compose.ymlでDEV_PAGES_AUTH_DISABLED=trueを指定)では認証なし、それ以外では
// 環境変数で設定したユーザー名・パスワードのBasic認証を求め、未設定なら存在しないページとして扱う。
// import.meta.env.DEVはビルドした環境で値が決まり、開発用コンテナでビルドすると本番用の成果物でも
// trueになってしまうため使わない。設定を忘れても認証がかかる側に倒れるよう、無効化は明示的に指定させる。
import { createHash, timingSafeEqual } from "node:crypto";

export type DevPageAccess = "allow" | "not_found" | "unauthorized";

export type DevPageCredentials = { user: string; password: string };

const DEV_PAGE_PREFIX = "/dev";

// /devと/dev/以下が対象。「/devops-tips」のようにdevで始まる記事slugは含めない
export const isDevPagePath = (pathname: string): boolean =>
  pathname === DEV_PAGE_PREFIX || pathname.startsWith(`${DEV_PAGE_PREFIX}/`);

// 文字列の比較にかかる時間からパスワードを推測されないよう、一定時間で比較する。
// 長さが違うと早く返す実装だと長さが漏れるため、両方をSHA-256で同じ長さにしてから比べる
const safeEqual = (a: string, b: string): boolean => {
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(a), digest(b));
};

// "Basic base64(user:password)"形式のAuthorizationヘッダーから認証情報を取り出す
const parseBasicAuthorization = (
  authorization: string,
): DevPageCredentials | undefined => {
  const match = authorization.match(/^Basic\s+(.+)$/i);
  if (!match) return undefined;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  // パスワードには:を含められるため、最初の:だけで分ける
  const separator = decoded.indexOf(":");
  if (separator === -1) return undefined;
  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
};

// /dev配下のリクエストを表示してよいか判定する
export const checkDevPageAccess = ({
  authDisabled,
  authorization,
  credentials,
}: {
  authDisabled: boolean;
  authorization: string | null;
  credentials: DevPageCredentials | undefined;
}): DevPageAccess => {
  if (authDisabled) return "allow";
  if (!credentials) return "not_found";
  const sent = authorization
    ? parseBasicAuthorization(authorization)
    : undefined;
  if (!sent) return "unauthorized";
  // ユーザー名とパスワードの両方を必ず比較し、どちらで失敗したかを時間差で悟らせない
  const userMatches = safeEqual(sent.user, credentials.user);
  const passwordMatches = safeEqual(sent.password, credentials.password);
  return userMatches && passwordMatches ? "allow" : "unauthorized";
};
