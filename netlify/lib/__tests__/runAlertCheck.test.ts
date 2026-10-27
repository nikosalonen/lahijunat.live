// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createMemoryAlertStore } from "../memoryStore";
import { runAlertCheck } from "../runAlertCheck";
import { endpointPrefix, recordKey } from "../store";
import type {
	AlertPush,
	AlertRecord,
	DigitrafficMessage,
	TrainRef,
	TrainStatus,
} from "../types";

const now = new Date("2026-10-27T06:20:00Z");
const siteUrl = "https://www.lahijunat.live";
const endpoint = "https://fcm.googleapis.com/fcm/send/one";

const makeRecord = (over: Partial<AlertRecord> = {}): AlertRecord => ({
	endpoint,
	keys: { p256dh: "p", auth: "a" },
	trainNumber: 9638,
	departureDate: "2026-10-27",
	from: "RI",
	to: "HKI",
	fromName: "Riihimäki",
	toName: "Helsinki",
	title: "9638 Riihimäki → Helsinki",
	lang: "fi",
	removeAfter: "2026-10-27T08:00:00Z",
	sent: {},
	cancelSent: false,
	createdAt: "2026-10-27T06:00:00Z",
	...over,
});

const keyOf = (record: AlertRecord) =>
	recordKey(record.endpoint, {
		trainNumber: record.trainNumber,
		departureDate: record.departureDate,
	});

type Store = ReturnType<typeof createMemoryAlertStore>;

async function seed(store: Store, ...records: AlertRecord[]) {
	for (const record of records) await store.put(keyOf(record), record);
}

const message: DigitrafficMessage = {
	id: "MVM1",
	version: 1,
	creationDateTime: "2026-10-27T06:19:00Z",
	startValidity: "2026-10-27T06:19:00Z",
	endValidity: "2026-10-29T00:00:00Z",
	trainNumber: 9638,
	trainDepartureDate: "2026-10-27",
	stations: ["RI", "HKI"],
	video: { text: { fi: "Teksti yksi", sv: null, en: "Text one" } },
};

const cancelledTrain: TrainStatus = {
	trainNumber: 9638,
	departureDate: "2026-10-27",
	cancelled: true,
	rows: [],
};

function setup(over: Partial<Parameters<typeof runAlertCheck>[0]> = {}) {
	const store = createMemoryAlertStore();
	const fetchMessages = vi.fn(async () => [message]);
	const fetchTrains = vi.fn(async (_trains: TrainRef[]) => [] as TrainStatus[]);
	const send = vi.fn(
		async (_record: AlertRecord, _push: AlertPush) => "sent" as const,
	);
	const deps = {
		store,
		now,
		enabled: true,
		siteUrl,
		fetchMessages,
		fetchTrains,
		send,
		...over,
	};
	return { store, fetchMessages, fetchTrains, send, deps };
}

describe("runAlertCheck", () => {
	it("skips without fetching when there are no records", async () => {
		const { store, fetchMessages, fetchTrains, deps } = setup();
		const setMeta = vi.spyOn(store, "setMeta");
		const summary = await runAlertCheck(deps);
		expect(summary.skipped).toBe("empty");
		expect(fetchMessages).not.toHaveBeenCalled();
		expect(fetchTrains).not.toHaveBeenCalled();
		expect(setMeta).not.toHaveBeenCalled();
	});

	it("still deletes expired records when disabled", async () => {
		const { store, deps } = setup({ enabled: false });
		const live = makeRecord();
		const pastRemoveAfter = makeRecord({
			trainNumber: 9640,
			removeAfter: "2026-10-27T06:00:00Z",
		});
		const beforeYesterday = makeRecord({
			trainNumber: 9642,
			departureDate: "2026-10-25",
			removeAfter: "2026-10-28T00:00:00Z",
		});
		await seed(store, live, pastRemoveAfter, beforeYesterday);
		const summary = await runAlertCheck(deps);
		expect(summary).toMatchObject({
			skipped: "disabled",
			records: 3,
			deleted: 2,
		});
		expect(await store.get(keyOf(live))).not.toBeNull();
		expect(await store.get(keyOf(pastRemoveAfter))).toBeNull();
		expect(await store.get(keyOf(beforeYesterday))).toBeNull();
	});

	it("fetches, sends and writes meta for nothing when disabled", async () => {
		const { store, fetchMessages, fetchTrains, send, deps } = setup({
			enabled: false,
		});
		await seed(
			store,
			makeRecord(),
			makeRecord({ trainNumber: 9640, removeAfter: "2026-10-27T06:00:00Z" }),
		);
		const setMeta = vi.spyOn(store, "setMeta");
		await runAlertCheck(deps);
		expect(fetchMessages).not.toHaveBeenCalled();
		expect(fetchTrains).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
		expect(setMeta).not.toHaveBeenCalled();
	});

	it("sends a push and stores the sent mark", async () => {
		const { store, send, deps } = setup();
		const record = makeRecord();
		await seed(store, record);
		const summary = await runAlertCheck(deps);
		expect(send).toHaveBeenCalledTimes(1);
		expect(summary).toMatchObject({
			records: 1,
			pushesSent: 1,
			pushesFailed: 0,
			deleted: 0,
			writeErrors: 0,
			messagesOk: true,
			trainsOk: true,
		});
		const stored = await store.get(keyOf(record));
		expect(Object.keys(stored?.record.sent ?? {})).toEqual(["MVM1"]);
	});

	it("deletes all records of an endpoint that returns gone", async () => {
		const { store, deps } = setup({ send: vi.fn(async () => "gone" as const) });
		await seed(store, makeRecord(), makeRecord({ trainNumber: 9640 }));
		const summary = await runAlertCheck({
			...deps,
			fetchMessages: async () => [
				message,
				{ ...message, id: "MVM2", trainNumber: 9640 },
			],
		});
		expect(summary.deleted).toBe(2);
		expect(await store.list(endpointPrefix(endpoint))).toEqual([]);
	});

	it("keeps the mark off after a failed send so the next run retries", async () => {
		const send = vi.fn(async () => "failed" as const);
		const { store, deps } = setup({ send });
		const record = makeRecord();
		await seed(store, record);
		const first = await runAlertCheck(deps);
		expect(first.pushesFailed).toBe(1);
		expect(send).toHaveBeenCalledTimes(1);
		await runAlertCheck(deps);
		expect(send).toHaveBeenCalledTimes(2);
		expect((await store.get(keyOf(record)))?.record.sent).toEqual({});
	});

	it("keeps the mark after a dropped send and counts it as failed", async () => {
		const send = vi.fn(async () => "dropped" as const);
		const { store, deps } = setup({ send });
		const record = makeRecord();
		await seed(store, record);
		const summary = await runAlertCheck(deps);
		expect(summary.pushesFailed).toBe(1);
		await runAlertCheck(deps);
		expect(send).toHaveBeenCalledTimes(1);
		const stored = await store.get(keyOf(record));
		expect(Object.keys(stored?.record.sent ?? {})).toEqual(["MVM1"]);
	});

	it("still checks cancellations when announcements fail", async () => {
		const { store, send, deps } = setup({
			fetchMessages: vi.fn(async () => {
				throw new Error("down");
			}),
			fetchTrains: vi.fn(async () => [cancelledTrain]),
		});
		await seed(store, makeRecord());
		const summary = await runAlertCheck(deps);
		expect(send).toHaveBeenCalledTimes(1);
		expect(summary.messagesOk).toBe(false);
		expect(summary.trainsOk).toBe(true);
	});

	it("does not resurrect a record deleted during the run", async () => {
		const record = makeRecord();
		const key = keyOf(record);
		const { store, deps } = setup();
		await seed(store, record);
		const send = vi.fn(async () => {
			await store.delete(key);
			return "sent" as const;
		});
		await runAlertCheck({ ...deps, send });
		expect(await store.get(key)).toBeNull();
	});

	it("asks for at most 40 trains", async () => {
		const { store, fetchTrains, deps } = setup();
		const records = Array.from({ length: 45 }, (_, i) =>
			makeRecord({ trainNumber: 1000 + i }),
		);
		await seed(store, ...records);
		await runAlertCheck(deps);
		expect(fetchTrains).toHaveBeenCalledTimes(1);
		expect(fetchTrains.mock.calls[0][0]).toHaveLength(40);
	});

	it("writes meta/last-run after work", async () => {
		const { store, deps } = setup();
		await seed(store, makeRecord());
		const setMeta = vi.spyOn(store, "setMeta");
		await runAlertCheck(deps);
		expect(setMeta).toHaveBeenCalledWith(
			"meta/last-run",
			expect.objectContaining({
				at: now.toISOString(),
				records: 1,
				pushesSent: 1,
			}),
		);
	});

	it("keeps writing other records when one put rejects", async () => {
		const { store, deps } = setup();
		const a = makeRecord();
		const b = makeRecord({ trainNumber: 9640 });
		await seed(store, a, b);
		const realPut = store.put.bind(store);
		vi.spyOn(store, "put").mockImplementation((key, record, opts) =>
			key === keyOf(a)
				? Promise.reject(new Error("blob down"))
				: realPut(key, record, opts),
		);
		const setMeta = vi.spyOn(store, "setMeta");
		const summary = await runAlertCheck({
			...deps,
			fetchMessages: async () => [
				message,
				{ ...message, id: "MVM2", trainNumber: 9640 },
			],
		});
		expect(summary.writeErrors).toBe(1);
		expect(Object.keys((await store.get(keyOf(b)))?.record.sent ?? {})).toEqual(
			["MVM2"],
		);
		expect(setMeta).toHaveBeenCalledWith(
			"meta/last-run",
			expect.objectContaining({ writeErrors: 1 }),
		);
	});

	it("keeps checking other records when one read rejects", async () => {
		const { store, send, deps } = setup();
		const a = makeRecord();
		const b = makeRecord({ trainNumber: 9640 });
		await seed(store, a, b);
		const realGet = store.get.bind(store);
		vi.spyOn(store, "get").mockImplementation((key) =>
			key === keyOf(a) ? Promise.reject(new Error("blob down")) : realGet(key),
		);
		const summary = await runAlertCheck({
			...deps,
			fetchMessages: async () => [
				message,
				{ ...message, id: "MVM2", trainNumber: 9640 },
			],
		});
		expect(summary).toMatchObject({ records: 1, readErrors: 1, pushesSent: 1 });
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][1].tag).toBe("MVM2");
	});

	it("keeps going when a delete rejects", async () => {
		const { store, deps } = setup({ send: vi.fn(async () => "gone" as const) });
		const a = makeRecord();
		const b = makeRecord({ trainNumber: 9640 });
		await seed(store, a, b);
		const realDelete = store.delete.bind(store);
		vi.spyOn(store, "delete").mockImplementation((key) =>
			key === keyOf(a)
				? Promise.reject(new Error("blob down"))
				: realDelete(key),
		);
		const setMeta = vi.spyOn(store, "setMeta");
		const summary = await runAlertCheck({
			...deps,
			fetchMessages: async () => [message],
		});
		expect(summary.writeErrors).toBe(1);
		expect(await store.get(keyOf(b))).toBeNull();
		expect(setMeta).toHaveBeenCalled();
	});
});
