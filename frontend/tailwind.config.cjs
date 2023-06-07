const { fontFamily } = require('tailwindcss/defaultTheme');
/** @type {import('tailwindcss').Config} */
module.exports = {
	mode: 'jit',
	content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
	theme: {
		extend: {
			colors: {
				white: 'var(--white)',
				black: 'var(--black)',
				brown: 'var(--brown)',
				pink: 'var(--pink)',
				orange: 'var(--orange)',
				blue: 'var(--blue)',
				'dark-blue': 'var(--dark-blue)',
				green: 'var(--green)',
				red: 'var(--red)'
			},
			fontFamily: {
				numbers:['Helvetica','Mongolian Baiti',...fontFamily.serif],
				serif: ['Varela Round','Kosugi Maru','ui-sans-serif','system-ui','-apple-system','BlinkMacSystemFont','Segoe UI,Roboto','Helvetica Neue','Arial,Noto Sans','sans-serif','Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji', ...fontFamily.serif],
				sans: ['Noto Sans JP','sans-serif', ...fontFamily.sans]
			}
		}
	},
	plugins: [require('@tailwindcss/line-clamp')]
};
