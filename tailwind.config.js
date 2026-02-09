import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				green: {
					DEFAULT: '#A6FF00'
				}
			}
		}
	},
	plugins: [
		typography
	]
};
