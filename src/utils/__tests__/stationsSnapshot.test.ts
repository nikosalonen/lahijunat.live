// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// Runs in a node environment (no window) so fetchStations takes the
// prerender code path, where a failed API call must fall back to the
// committed stations snapshot instead of killing the build.
describe("fetchStations snapshot fallback (prerender)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("returns the committed snapshot when the API is unavailable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })),
		);

		const { fetchStations } = await import("../api");
		const stations = await fetchStations();

		expect(stations.length).toBeGreaterThan(50);
		expect(stations.some((s) => s.shortCode === "HKI")).toBe(true);
		expect(stations.every((s) => typeof s.name === "string")).toBe(true);
	});
});
