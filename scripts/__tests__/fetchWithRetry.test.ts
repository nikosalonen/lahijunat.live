import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../fetchWithRetry";

function response(status: number): Response {
	return new Response(null, { status });
}

describe("fetchWithRetry", () => {
	it("returns the first OK response without retrying", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(response(200));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const result = await fetchWithRetry(
			"https://example.test",
			{},
			{ fetchImpl, sleep },
		);

		expect(result.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it("retries a 403 with growing delays and returns the eventual success", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(response(403))
			.mockResolvedValueOnce(response(403))
			.mockResolvedValueOnce(response(200));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const result = await fetchWithRetry(
			"https://example.test",
			{},
			{ fetchImpl, sleep, baseDelayMs: 1000 },
		);

		expect(result.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledTimes(3);
		expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 3000]);
	});

	it("retries a network error", async () => {
		const fetchImpl = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(response(200));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const result = await fetchWithRetry(
			"https://example.test",
			{},
			{ fetchImpl, sleep },
		);

		expect(result.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it("returns the last failing response once attempts run out", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(response(403));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const result = await fetchWithRetry(
			"https://example.test",
			{},
			{ fetchImpl, sleep, attempts: 3 },
		);

		expect(result.status).toBe(403);
		expect(fetchImpl).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it("rethrows a network error once attempts run out", async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
		const sleep = vi.fn().mockResolvedValue(undefined);

		await expect(
			fetchWithRetry(
				"https://example.test",
				{},
				{ fetchImpl, sleep, attempts: 2 },
			),
		).rejects.toThrow("fetch failed");
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it("does not retry a 404, which will not fix itself", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(response(404));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const result = await fetchWithRetry(
			"https://example.test",
			{},
			{ fetchImpl, sleep },
		);

		expect(result.status).toBe(404);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});
