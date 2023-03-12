import Paragraph from "~/components/atom/ghost/Paragraph.astro";
import Title from "~/components/atom/ghost/Title.astro";
import Span from "~/components/atom/ghost/Span.astro";
import A from "~/components/atom/ghost/A.astro";
import Div from "~/components/atom/ghost/Div.astro";
import Img from "~/components/atom/ghost/Img.astro";

export const sanitize = {
	dropElements: ["head"],
	blockElements: ["html", "body"],
};

export const components = {
	h1: Title,
	p: Paragraph,
	span: Span,
	a: A,
	div: Div,
	img: Img,
};
