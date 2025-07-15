/**
 * @format
 * @type {import('tailwindcss').Config}
 */

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      keyframes: {
        "fade-out": {
          "0%": { opacity: "1" },
          "50%": { opacity: "0.5" },
          "100%": { opacity: "0" },
        },
        "soft-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "soft-blink-dark": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.9" },
        },
        "soft-blink-highlight": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.9" },
        },
        "soft-blink-highlight-dark": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.95" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "train-arrive": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "train-depart": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
      },
      animation: {
        "fade-out": "fade-out 3s linear forwards",
        "soft-blink": "soft-blink 2s ease-in-out infinite",
        "soft-blink-dark": "soft-blink-dark 2s ease-in-out infinite",
        "soft-blink-highlight": "soft-blink-highlight 2s ease-in-out infinite",
        "soft-blink-highlight-dark":
          "soft-blink-highlight-dark 2s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "bounce-subtle": "bounce-subtle 0.6s ease-in-out",
        shimmer: "shimmer 2s linear infinite",
        "train-arrive": "train-arrive 0.8s ease-out",
        "train-depart": "train-depart 0.6s ease-in forwards",
      },
    },
  },
  darkMode: "class",
  plugins: [],
};
