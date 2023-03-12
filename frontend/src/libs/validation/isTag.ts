/**
 * 英数記号のみかどうかを判定する
 */
export function isTag(tag: string): boolean {
	return !(tag.match(/^[!-~]+$/) === null);
}
