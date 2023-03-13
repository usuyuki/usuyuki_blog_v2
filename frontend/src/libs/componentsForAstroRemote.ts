import A from '~/components/atom/ghost/A.astro';
import Div from '~/components/atom/ghost/Div.astro';
import Paragraph from '~/components/atom/ghost/Paragraph.astro';
import Span from '~/components/atom/ghost/Span.astro';
import Title from '~/components/atom/ghost/Title.astro';
import Figure from '~/components/atom/ghost/Figure.astro';

export const sanitize = {
	dropElements: ['head'],
	blockElements: ['html', 'body']
};

export const components = {
	h1: Title,
	p: Paragraph,
	span: Span,
	a: A,
	div: Div,
	figure: Figure,
	// img: Img
	// Ghostがよしなにしてくれるのでそれにのっかる
};
