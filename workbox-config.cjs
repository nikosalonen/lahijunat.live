module.exports = {
	globDirectory: "dist/",
	globPatterns: ["**/*.{js,css,xml,eot,ttf,woff,woff2,png,svg,json}"],
	// Avoid precaching HTML pages to keep install size small; use runtime caching instead
	globIgnores: ["**/*.html"],
	swDest: "dist/sw.js",
	swSrc: "src/sw-template.js",
};
