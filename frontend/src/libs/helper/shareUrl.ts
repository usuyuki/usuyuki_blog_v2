export function buildTwitterShareUrl(url: string, title: string): string {
	const text = encodeURIComponent(
		`${title} | うすゆきブログ\n${url}\n#うすゆきブログ`,
	);
	return `https://twitter.com/intent/tweet?text=${text}`;
}

export function buildHatenaBookmarkUrl(url: string): string {
	const parsed = new URL(url);
	const path = parsed.hostname + parsed.pathname + parsed.search;
	return `https://b.hatena.ne.jp/entry/s/${path}`;
}

export function buildMisskeyShareUrl(url: string, title: string): string {
	const text = encodeURIComponent(
		`${title} | うすゆきブログ\n${url}\n#うすゆきブログ`,
	);
	return `https://misskey-hub.net/share?text=${text}`;
}
