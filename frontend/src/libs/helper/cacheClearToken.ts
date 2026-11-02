import { createHash, timingSafeEqual } from "node:crypto";

// 長さに依存せず定数時間で比較できるよう、比較前にSHA-256で固定長にそろえる
function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// 手動キャッシュクリア用トークンを検証する。
// expected(環境変数CACHE_CLEAR_TOKEN)が未設定・空文字の場合は機能自体を無効とみなし常にfalseを返す。
// タイミング攻撃でトークンを推測されないよう、timingSafeEqualで比較する。
export function isCacheClearTokenValid(
  provided: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || provided === null) return false;
  return timingSafeEqual(sha256(provided), sha256(expected));
}
