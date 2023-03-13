import type { TOCType } from '~/types/TOCType';
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
				toc.push({
					id: id[1],
					title: title[1],
					heading: parseInt(heading[1], 10)
				});
			}
		});
	}
	return toc;
};
