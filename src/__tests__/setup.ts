import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { afterEach } from "vitest";

// Mock window.matchMedia for components that use media queries.
// Guarded so test files using `// @vitest-environment node` can share this setup.
if (typeof window !== "undefined") {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
	cleanup();
});
