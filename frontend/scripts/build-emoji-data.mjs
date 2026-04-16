import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const en = require("emoji-picker-element-data/en/cldr/data.json");
const ja = require("emoji-picker-element-data/ja/cldr/data.json");

const enByEmoji = new Map(en.map((e) => [e.emoji, e]));

// 日本語インターネットスラングや慣用的な検索キーワードのカスタムマッピング
// emoji-picker-elementは2文字未満のトークンをフィルタするため、2文字以上で記述する
const customJaSearchTags = {
	"😂": ["草草", "笑笑", "わらい", "うける"],
	"🤣": ["草草", "笑笑", "わらい"],
	"😆": ["草草", "わらい"],
	"😄": ["わらい", "にこにこ"],
	"😃": ["わらい", "にこにこ"],
	"😊": ["にこにこ"],
	"🙂": ["にこにこ"],
};

// 1文字のCJK文字かどうかを判定（漢字、ひらがな、カタカナ）
function isSingleCJKChar(str) {
	return str.length === 1 && /[\u3040-\u9fff\uf900-\ufaff]/.test(str);
}

const merged = ja.map((jaEntry) => {
	const enEntry = enByEmoji.get(jaEntry.emoji);
	const extraTags = enEntry
		? [enEntry.annotation, ...enEntry.tags].filter(
				(t) => !jaEntry.tags.includes(t),
			)
		: [];

	const allTags = [...jaEntry.tags, ...extraTags];

	// 1文字のCJK文字タグを2倍にして、2文字最小フィルタをパスできるようにする
	// （emoji-picker-elementはMIN_SEARCH_TEXT_LENGTH=2のため）
	const singleCJKSources = [...allTags];
	const annotation = jaEntry.annotation || "";
	if (isSingleCJKChar(annotation)) {
		singleCJKSources.push(annotation);
	}
	const doubledCJKTags = [
		...new Set(singleCJKSources.filter(isSingleCJKChar)),
	].map((t) => t + t);

	const slangTags = customJaSearchTags[jaEntry.emoji] || [];

	return {
		...jaEntry,
		tags: [...new Set([...allTags, ...doubledCJKTags, ...slangTags])],
	};
});

writeFileSync("public/emoji-data-ja.json", JSON.stringify(merged));
