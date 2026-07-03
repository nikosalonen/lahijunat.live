// Copies src/sw-utils.js into dist/ with the package.json version stamped in,
// so the service worker can report which app release it belongs to
// (see public/sw-register.js).
import fs from "node:fs";

const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
const source = fs.readFileSync("src/sw-utils.js", "utf8");

if (!source.includes("__APP_VERSION__")) {
	console.error(
		"src/sw-utils.js is missing the __APP_VERSION__ placeholder; update toasts would fire on every deploy",
	);
	process.exit(1);
}

fs.writeFileSync("dist/sw-utils.js", source.replaceAll("__APP_VERSION__", version));
console.log(`Stamped sw-utils.js with version ${version}`);
