// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleAlertsRequest } from "../handleAlertsRequest";
import { createMemoryAlertStore } from "../memoryStore";
import { type AlertStore, endpointPrefix, recordKey } from "../store";
import type { AlertRecord } from "../types";

const now = new Date("2026-10-27T10:00:00Z");
const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
const today = "2026-10-27";

const payload = (overrides: Record<string, unknown> = {}) => ({
	subscription: { endpoint, keys: { p256dh: "BPabc", auth: "xyz" } },
	trainNumber: 9638,
	departureDate: today,
	from: "HKI",
	to: "TPE",
	fromName: "Helsinki",
	toName: "Tampere",
	title: "IC 9638",
	lang: "fi",
	removeAfter: "2026-10-27T20:00:00Z",
	...overrides,
});

const call = (
	store: AlertStore,
	method: string,
	body?: unknown,
	enabled = true,
) =>
	handleAlertsRequest(
		new Request("https://www.lahijunat.live/api/alerts", {
			method,
			headers: { "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
		{ store, now, enabled },
	);

const stored = (overrides: Partial<AlertRecord> = {}): AlertRecord => ({
	endpoint,
	keys: { p256dh: "BPabc", auth: "xyz" },
	trainNumber: 9638,
	departureDate: today,
	from: "HKI",
	to: "TPE",
	fromName: "Helsinki",
	toName: "Tampere",
	title: "IC 9638",
	lang: "fi",
	removeAfter: "2026-10-27T20:00:00Z",
	sent: {},
	cancelSent: false,
	createdAt: "2026-10-27T09:00:00.000Z",
	...overrides,
});

const myKey = recordKey(endpoint, { trainNumber: 9638, departureDate: today });

describe("body size", () => {
	it("stops reading a body once it is over the limit", async () => {
		const chunk = new TextEncoder().encode("x".repeat(4096));
		let pulled = 0;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulled++;
				if (pulled > 10) controller.close();
				else controller.enqueue(chunk);
			},
		});
		const response = await handleAlertsRequest(
			new Request("https://www.lahijunat.live/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: stream,
				duplex: "half",
			} as RequestInit),
			{ store: createMemoryAlertStore(), now, enabled: true },
		);
		expect(response.status).toBe(413);
		// 8192 bytes is passed during the third chunk; the rest is never read.
		expect(pulled).toBeLessThan(10);
	});
});

/** Fills the store with other devices' records, one per index. */
async function fill(
	store: AlertStore,
	count: number,
	trainOf: (i: number) => number = (i) => i + 1,
) {
	for (let i = 0; i < count; i++) {
		const other = `https://fcm.googleapis.com/fcm/send/other-${i}`;
		const trainNumber = trainOf(i);
		await store.put(
			recordKey(other, { trainNumber, departureDate: today }),
			stored({ endpoint: other, trainNumber }),
		);
	}
}

describe("handleAlertsRequest", () => {
	it("POST creates a record and returns 204", async () => {
		const store = createMemoryAlertStore();
		const res = await call(store, "POST", payload());
		expect(res.status).toBe(204);
		expect((await store.get(myKey))?.record).toMatchObject({
			endpoint,
			title: "IC 9638",
			sent: {},
			cancelSent: false,
			createdAt: now.toISOString(),
		});
	});

	it("POST of a train already cancelled marks the cancellation as sent", async () => {
		const store = createMemoryAlertStore();
		const res = await call(store, "POST", payload({ cancelled: true }));
		expect(res.status).toBe(204);
		expect((await store.get(myKey))?.record.cancelSent).toBe(true);
	});

	it("re-POST keeps the record's own cancelSent", async () => {
		const store = createMemoryAlertStore();
		await store.put(myKey, stored({ cancelSent: false }));
		await call(store, "POST", payload({ cancelled: true }));
		expect((await store.get(myKey))?.record.cancelSent).toBe(false);
	});

	it("re-POST keeps sent marks and updates route", async () => {
		const store = createMemoryAlertStore();
		await store.put(myKey, stored({ sent: { m1: "h1" }, cancelSent: true }));
		const res = await call(store, "POST", payload({ to: "OL", title: "New" }));
		expect(res.status).toBe(204);
		expect((await store.get(myKey))?.record).toMatchObject({
			to: "OL",
			title: "New",
			sent: { m1: "h1" },
			cancelSent: true,
			createdAt: "2026-10-27T09:00:00.000Z",
		});
	});

	it("re-merges fresh job state when the first conditional write loses", async () => {
		const memory = createMemoryAlertStore();
		await memory.put(myKey, stored());
		let lostRaces = 1;
		const store: AlertStore = {
			...memory,
			async put(key, record, opts) {
				if (lostRaces > 0) {
					lostRaces--;
					// The job marks a message sent between our read and write.
					await memory.put(key, stored({ sent: { m2: "h2" } }));
					return false;
				}
				return memory.put(key, record, opts);
			},
		};
		const res = await call(store, "POST", payload({ title: "Retry" }));
		expect(res.status).toBe(204);
		expect((await memory.get(myKey))?.record).toMatchObject({
			title: "Retry",
			sent: { m2: "h2" },
		});
	});

	it("returns 409 when the conditional write loses twice", async () => {
		const memory = createMemoryAlertStore();
		await memory.put(myKey, stored());
		const store: AlertStore = { ...memory, put: async () => false };
		const res = await call(store, "POST", payload());
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: "conflict" });
	});

	it("returns 503 full at 300 records", async () => {
		const store = createMemoryAlertStore();
		await fill(store, 300, (i) => (i % 40) + 1);
		const res = await call(store, "POST", payload({ trainNumber: 1 }));
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: "full" });
		expect(res.headers.get("Content-Type")).toBe("application/json");
	});

	it("returns 503 full for a 41st distinct train", async () => {
		const store = createMemoryAlertStore();
		await fill(store, 40);
		const res = await call(store, "POST", payload());
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: "full" });
	});

	it("accepts a new subscriber to an already tracked train at 40 trains", async () => {
		const store = createMemoryAlertStore();
		await fill(store, 40, (i) => (i === 0 ? 9638 : i + 1000));
		expect((await call(store, "POST", payload())).status).toBe(204);
	});

	it("returns 429 at 20 records for one endpoint", async () => {
		const store = createMemoryAlertStore();
		for (let i = 0; i < 20; i++) {
			const trainNumber = 100 + i;
			await store.put(
				recordKey(endpoint, { trainNumber, departureDate: today }),
				stored({ trainNumber }),
			);
		}
		const res = await call(store, "POST", payload());
		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({ error: "too-many" });
	});

	it("DELETE one train", async () => {
		const store = createMemoryAlertStore();
		await call(store, "POST", payload());
		await call(store, "POST", payload({ trainNumber: 1 }));
		const res = await call(store, "DELETE", {
			endpoint,
			trainNumber: 9638,
			departureDate: today,
		});
		expect(res.status).toBe(204);
		expect(await store.list(endpointPrefix(endpoint))).toHaveLength(1);
		expect(await store.get(myKey)).toBeNull();
	});

	it("DELETE all for endpoint", async () => {
		const store = createMemoryAlertStore();
		await call(store, "POST", payload());
		await call(store, "POST", payload({ trainNumber: 1 }));
		await fill(store, 1);
		const res = await call(store, "DELETE", { endpoint });
		expect(res.status).toBe(204);
		expect(await store.list(endpointPrefix(endpoint))).toHaveLength(0);
		expect(await store.list("sub/")).toHaveLength(1);
	});

	it("returns 503 disabled when enabled is false", async () => {
		const res = await call(createMemoryAlertStore(), "POST", payload(), false);
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: "disabled" });
	});

	it("returns 405 for GET", async () => {
		const res = await call(createMemoryAlertStore(), "GET");
		expect(res.status).toBe(405);
	});

	it("returns 400 for invalid JSON and for invalid fields", async () => {
		const store = createMemoryAlertStore();
		const bad = await handleAlertsRequest(
			new Request("https://www.lahijunat.live/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{nope",
			}),
			{ store, now, enabled: true },
		);
		expect(bad.status).toBe(400);
		const res = await call(store, "POST", payload({ lang: "de" }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid lang" });
	});

	it("returns 415 for POST and DELETE that are not JSON", async () => {
		const store = createMemoryAlertStore();
		const send = (method: string, headers: Record<string, string>) =>
			handleAlertsRequest(
				new Request("https://www.lahijunat.live/api/alerts", {
					method,
					headers,
					body: JSON.stringify(payload()),
				}),
				{ store, now, enabled: true },
			);
		const plain = await send("POST", { "Content-Type": "text/plain" });
		expect(plain.status).toBe(415);
		expect(await plain.json()).toEqual({ error: "unsupported media type" });
		expect((await send("DELETE", {})).status).toBe(415);
		expect(await store.list("sub/")).toEqual([]);
	});

	it("accepts a JSON content type in any case and with parameters", async () => {
		const res = await handleAlertsRequest(
			new Request("https://www.lahijunat.live/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "Application/JSON; charset=utf-8" },
				body: JSON.stringify(payload()),
			}),
			{ store: createMemoryAlertStore(), now, enabled: true },
		);
		expect(res.status).toBe(204);
	});

	it("returns 413 for a body over 8192 bytes", async () => {
		const res = await call(
			createMemoryAlertStore(),
			"POST",
			payload({ title: "x".repeat(9000) }),
		);
		expect(res.status).toBe(413);
		expect(await res.json()).toEqual({ error: "too large" });
	});
});
