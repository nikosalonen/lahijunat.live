/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			keyframes: {
				'fade-out': {
					'0%': { opacity: '1' },
					'50%': { opacity: '0.5' },
					'100%': { opacity: '0' }
				},
				'soft-blink': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.8' },
				},
				'soft-blink-dark': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.9' },
				},
				'soft-blink-highlight': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.9' },
				},
				'soft-blink-highlight-dark': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.95' },
				},
			},
			animation: {
				'fade-out': 'fade-out 3s linear forwards',
				'soft-blink': 'soft-blink 2s ease-in-out infinite',
				'soft-blink-dark': 'soft-blink-dark 2s ease-in-out infinite',
				'soft-blink-highlight': 'soft-blink-highlight 2s ease-in-out infinite',
				'soft-blink-highlight-dark': 'soft-blink-highlight-dark 2s ease-in-out infinite',
			},
		},
	},
	darkMode: "class",
	plugins: [],
};
