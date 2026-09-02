import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translations } from "../translations";

const languages = Object.keys(translations) as (keyof typeof translations)[];
const finnishKeys = Object.keys(translations.fi);

/** Every source file under src/, skipping tests. */
function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) {
			return entry === "__tests__" ? [] : sourceFiles(full);
		}
		return /\.(ts|tsx|astro)$/.test(entry) ? [full] : [];
	});
}

/** Translation keys referenced from code: t("x"), tf("x"), translationKey: "x", titleKey="x". */
function referencedKeys(): Map<string, string> {
	const found = new Map<string, string>();
	const patterns = [
		/\btf?\(\s*["']([A-Za-z0-9_]+)["']/g,
		/translationKey:\s*["']([A-Za-z0-9_]+)["']/g,
		/(?:titleKey|introKey)=["']([A-Za-z0-9_]+)["']/g,
	];
	for (const file of sourceFiles(path.resolve(__dirname, "../.."))) {
		if (file.endsWith("translations.ts")) continue;
		const text = readFileSync(file, "utf8");
		for (const pattern of patterns) {
			for (const match of text.matchAll(pattern)) {
				if (!found.has(match[1])) found.set(match[1], file);
			}
		}
	}
	return found;
}

const placeholders = (text: string) =>
	[...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
	it("has the same keys in every language", () => {
		for (const lang of languages) {
			expect(Object.keys(translations[lang]).sort()).toEqual(
				[...finnishKeys].sort(),
			);
		}
	});

	it("uses the same placeholders in every language", () => {
		for (const key of finnishKeys) {
			const expected = placeholders(
				translations.fi[key as keyof typeof translations.fi],
			);
			for (const lang of languages) {
				const dict = translations[lang] as Record<string, string>;
				expect(placeholders(dict[key]), `${lang}.${key}`).toEqual(expected);
			}
		}
	});

	it("defines every key the code asks for", () => {
		const missing = [...referencedKeys()]
			.filter(([key]) => !finnishKeys.includes(key))
			.map(([key, file]) => `${key} (${path.relative(process.cwd(), file)})`);
		expect(missing).toEqual([]);
	});
});
