module.exports = {
	globDirectory: "public/",
	globPatterns: ["**/*.{js,css,xml,eot,ttf,woff,png,html,svg,json}"],
	swDest: "dist/sw.js",
	ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
};
