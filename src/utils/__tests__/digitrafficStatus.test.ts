/** @format */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	__resetStatusCacheForTests,
	checkDigitrafficStatus,
} from "@/utils/api";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("checkDigitrafficStatus caching", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		__resetStatusCacheForTests();
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("caches a successful determination and serves it without re-fetching", async () => {
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(jsonResponse({ systems: [] }));

		const first = await checkDigitrafficStatus();
		const second = await checkDigitrafficStatus();

		expect(first.isDown).toBe(false);
		expect(second.isDown).toBe(false);
		// Second call is served from cache — fetch only happens once.
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it("re-fetches after the cache is cleared", async () => {
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(jsonResponse({ systems: [] }));

		await checkDigitrafficStatus();
		__resetStatusCacheForTests();
		await checkDigitrafficStatus();

		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("does not cache transient status-page failures", async () => {
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(jsonResponse({}, 503));

		const first = await checkDigitrafficStatus();
		const second = await checkDigitrafficStatus();

		// A non-OK status response is treated as "up" but never cached, so each
		// call re-checks.
		expect(first.isDown).toBe(false);
		expect(second.isDown).toBe(false);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("does not cache a network rejection", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockRejectedValue(new Error("network down"));

		const first = await checkDigitrafficStatus();
		const second = await checkDigitrafficStatus();

		// A fetch rejection falls back to "up" but is never cached, so each call
		// re-checks rather than pinning a failure for the cache duration.
		expect(first.isDown).toBe(false);
		expect(second.isDown).toBe(false);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("serves the cached result up to the TTL and re-fetches once past it", async () => {
		// 5-minute TTL — assert the boundary is exclusive (expires when the age
		// strictly exceeds the duration).
		const STATUS_DURATION = 5 * 60 * 1000;
		const t0 = 1_000_000_000;
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0);
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(jsonResponse({ systems: [] }));

		await checkDigitrafficStatus();
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		// Exactly at the TTL the age is not yet greater than the duration → cached.
		nowSpy.mockReturnValue(t0 + STATUS_DURATION);
		await checkDigitrafficStatus();
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		// One ms past the TTL → stale → re-fetch.
		nowSpy.mockReturnValue(t0 + STATUS_DURATION + 1);
		await checkDigitrafficStatus();
		expect(fetchSpy).toHaveBeenCalledTimes(2);

		nowSpy.mockRestore();
	});

	it("caches a detected outage", async () => {
		fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			jsonResponse({
				systems: [
					{
						name: "rail/graphql",
						status: "down",
						description: "Rail GraphQL",
						unresolvedIssues: [
							{
								title: "Outage",
								createdAt: "2026-06-01T00:00:00Z",
								permalink: "https://status.digitraffic.fi/x",
								severity: "major",
							},
						],
					},
				],
			}),
		);

		const first = await checkDigitrafficStatus();
		const second = await checkDigitrafficStatus();

		expect(first.isDown).toBe(true);
		expect(first.affectedSystems).toContain("Rail GraphQL");
		expect(second.isDown).toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});
});
