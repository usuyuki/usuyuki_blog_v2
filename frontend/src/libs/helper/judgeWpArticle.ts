/**
 * WordPressの記事かそうでないかを判定する
 * id="toc_container"が入っていると確実にWordPress
 * 正規表現でid="toc_container"がないかどうか抽出する
 * WordPress移行記事だと確実にid="toc_container"が入っているし、かなり最初に出てくるので一番これがまともな判定
 */
export const judgeWpArticle = (htmlString: string): boolean => {
	return (
		htmlString.match(/<[^>]*id\s*=\s*(["']?)toc_container\1[^>]*>/g) !== null
	);
};
