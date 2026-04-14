import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const en = require("emoji-picker-element-data/en/cldr/data.json");
const ja = require("emoji-picker-element-data/ja/cldr/data.json");

const enByEmoji = new Map(en.map((e) => [e.emoji, e]));

const merged = ja.map((jaEntry) => {
	const enEntry = enByEmoji.get(jaEntry.emoji);
	if (!enEntry) return jaEntry;
	const extraTags = [enEntry.annotation, ...enEntry.tags].filter(
		(t) => !jaEntry.tags.includes(t),
	);
	return {
		...jaEntry,
		tags: [...jaEntry.tags, ...extraTags],
	};
});

writeFileSync("public/emoji-data-ja.json", JSON.stringify(merged));
