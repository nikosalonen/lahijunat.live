// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
	buildTrainStatusQuery,
	DIGITRAFFIC_HEADERS,
	fetchActiveMessages,
	fetchTrainStatuses,
	fetchWithDeadline,
} from "../digitraffic";

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const stub = (response: Response) =>
	vi.fn<typeof fetch>().mockResolvedValue(response);

describe("fetchActiveMessages", () => {
	it("sends gzip and Digitraffic-User headers", async () => {
		const fetchImpl = stub(jsonResponse([]));
		await fetchActiveMessages(fetchImpl);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe(
			"https://rata.digitraffic.fi/api/v1/passenger-information/active",
		);
		expect(init?.method).toBe("GET");
		expect(init?.headers).toMatchObject(DIGITRAFFIC_HEADERS);
		expect(DIGITRAFFIC_HEADERS).toEqual({
			"Accept-Encoding": "gzip",
			"Digitraffic-User": "lahijunat.live/push-alerts",
		});
	});

	it("throws on HTTP 429", async () => {
		const fetchImpl = stub(new Response("slow down", { status: 429 }));
		await expect(fetchActiveMessages(fetchImpl)).rejects.toThrow("429");
	});

	it("throws when a 200 body is not an array", async () => {
		const fetchImpl = stub(jsonResponse({ error: "maintenance" }));
		await expect(fetchActiveMessages(fetchImpl)).rejects.toThrow(
			/not an array/,
		);
	});
});

describe("buildTrainStatusQuery", () => {
	it("aliases each train as t0, t1…", () => {
		const query = buildTrainStatusQuery([
			{ trainNumber: 9638, departureDate: "2026-10-27" },
			{ trainNumber: 9640, departureDate: "2026-10-27" },
		]);
		expect(query).toContain(
			't0: train(trainNumber: 9638, departureDate: "2026-10-27")',
		);
		expect(query).toContain(
			't1: train(trainNumber: 9640, departureDate: "2026-10-27")',
		);
	});
});

describe("train ref validation", () => {
	const good = { trainNumber: 9638, departureDate: "2026-10-27" };

	it("skips refs with a non-integer or out-of-range trainNumber", () => {
		const query = buildTrainStatusQuery([
			{ trainNumber: 1.5, departureDate: "2026-10-27" },
			{ trainNumber: 0, departureDate: "2026-10-27" },
			{ trainNumber: 100000, departureDate: "2026-10-27" },
			{ trainNumber: Number.NaN, departureDate: "2026-10-27" },
			good,
		]);
		expect(query).not.toContain("t0:");
		expect(query).not.toContain("t3:");
		expect(query).toContain("t4: train(trainNumber: 9638");
	});

	it("skips refs with a malformed departureDate", async () => {
		const bad = { trainNumber: 9638, departureDate: '2026-10-27") { x }' };
		expect(buildTrainStatusQuery([bad])).not.toContain("train(");
		const fetchImpl = stub(jsonResponse({}));
		expect(await fetchTrainStatuses([bad], fetchImpl)).toEqual([]);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("keeps alias-to-ref mapping when an invalid ref is skipped", async () => {
		const trains = [
			{ trainNumber: 0, departureDate: "2026-10-27" },
			good,
			{ trainNumber: 9640, departureDate: "2026-10-28" },
		];
		const fetchImpl = stub(
			jsonResponse({
				data: {
					t1: [{ trainNumber: 9638, cancelled: false, timeTableRows: [] }],
					t2: [{ trainNumber: 9640, cancelled: false, timeTableRows: [] }],
				},
			}),
		);
		const result = await fetchTrainStatuses(trains, fetchImpl);
		expect(result.map((s) => [s.trainNumber, s.departureDate])).toEqual([
			[9638, "2026-10-27"],
			[9640, "2026-10-28"],
		]);
		expect(
			JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).query,
		).toContain('t2: train(trainNumber: 9640, departureDate: "2026-10-28")');
	});
});

describe("fetchTrainStatuses", () => {
	const trains = [
		{ trainNumber: 9638, departureDate: "2026-10-27" },
		{ trainNumber: 9640, departureDate: "2026-10-27" },
	];

	it("maps GraphQL rows to TrainStatus", async () => {
		const fetchImpl = stub(
			jsonResponse({
				data: {
					t0: [
						{
							trainNumber: 9638,
							cancelled: false,
							timeTableRows: [
								{
									type: "DEPARTURE",
									cancelled: false,
									scheduledTime: "2026-10-27T06:25:00.000Z",
									liveEstimateTime: null,
									actualTime: "2026-10-27T06:24:58.000Z",
									station: { shortCode: "RI" },
								},
							],
						},
					],
					t1: [{ trainNumber: 9640, cancelled: false, timeTableRows: [] }],
				},
			}),
		);
		const result = await fetchTrainStatuses(trains, fetchImpl);
		expect(result).toHaveLength(2);
		expect(result[0].trainNumber).toBe(9638);
		expect(result[0].departureDate).toBe("2026-10-27");
		expect(result[0].cancelled).toBe(false);
		expect(result[0].rows[0]).toEqual({
			station: "RI",
			type: "DEPARTURE",
			cancelled: false,
			scheduledTime: "2026-10-27T06:25:00.000Z",
			liveEstimateTime: null,
			actualTime: "2026-10-27T06:24:58.000Z",
		});
		expect(result[1].rows).toEqual([]);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe("https://rata.digitraffic.fi/api/v2/graphql/graphql");
		expect(init?.method).toBe("POST");
		expect(init?.headers).toMatchObject({
			...DIGITRAFFIC_HEADERS,
			"Content-Type": "application/json",
		});
		expect(JSON.parse(String(init?.body)).query).toContain("t1: train(");
	});

	it("skips aliases with an empty array", async () => {
		const fetchImpl = stub(
			jsonResponse({
				data: {
					t0: [],
					t1: [{ trainNumber: 9640, cancelled: true, timeTableRows: [] }],
				},
			}),
		);
		const result = await fetchTrainStatuses(trains, fetchImpl);
		expect(result).toEqual([
			{
				trainNumber: 9640,
				departureDate: "2026-10-27",
				cancelled: true,
				rows: [],
			},
		]);
	});

	it("maps missing timeTableRows to no rows", async () => {
		const fetchImpl = stub(
			jsonResponse({
				data: {
					t0: [{ trainNumber: 9638, cancelled: true, timeTableRows: null }],
				},
			}),
		);
		const result = await fetchTrainStatuses(trains, fetchImpl);
		expect(result).toEqual([
			{
				trainNumber: 9638,
				departureDate: "2026-10-27",
				cancelled: true,
				rows: [],
			},
		]);
	});

	it("returns [] without calling fetch for no trains", async () => {
		const fetchImpl = stub(jsonResponse({}));
		expect(await fetchTrainStatuses([], fetchImpl)).toEqual([]);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("throws on a non-2xx response", async () => {
		const fetchImpl = stub(new Response("boom", { status: 503 }));
		await expect(fetchTrainStatuses(trains, fetchImpl)).rejects.toThrow("503");
	});

	it("throws on a GraphQL errors field", async () => {
		const fetchImpl = stub(jsonResponse({ errors: [{ message: "bad" }] }));
		await expect(fetchTrainStatuses(trains, fetchImpl)).rejects.toThrow(
			/GraphQL/,
		);
	});
});

describe("fetchWithDeadline", () => {
	it("passes an AbortSignal and keeps the other options", async () => {
		const base = stub(jsonResponse([]));
		await fetchWithDeadline(1000, base)("https://example.test/", {
			method: "POST",
		});
		const init = base.mock.calls[0][1];
		expect(init?.method).toBe("POST");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("rejects when the request never finishes", async () => {
		const base = vi.fn<typeof fetch>(
			(_input, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal?.reason),
					);
				}),
		);
		await expect(
			fetchWithDeadline(20, base)("https://example.test/"),
		).rejects.toBeDefined();
	});
});
