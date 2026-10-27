// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMemoryAlertStore } from "../memoryStore";
import { endpointPrefix, recordKey, trainOfKey } from "../store";
import type { AlertRecord } from "../types";

const record = (title = "IC 9638"): AlertRecord => ({
	endpoint: "https://fcm.googleapis.com/fcm/send/abc",
	keys: { p256dh: "p", auth: "a" },
	trainNumber: 9638,
	departureDate: "2026-10-27",
	from: "HKI",
	to: "TPE",
	fromName: "Helsinki",
	toName: "Tampere",
	title,
	lang: "fi",
	removeAfter: "2026-10-27T12:00:00Z",
	sent: {},
	cancelSent: false,
	createdAt: "2026-10-27T06:00:00Z",
});

const ref = { trainNumber: 9638, departureDate: "2026-10-27" };

describe("keys", () => {
	it("builds sub/<16 hex>/<date>-<number>", () => {
		expect(recordKey("https://push.example/1", ref)).toMatch(
			/^sub\/[0-9a-f]{16}\/2026-10-27-9638$/,
		);
	});

	it("gives the same prefix for the same endpoint", () => {
		expect(endpointPrefix("https://push.example/1")).toBe(
			endpointPrefix("https://push.example/1"),
		);
		expect(endpointPrefix("https://push.example/1")).not.toBe(
			endpointPrefix("https://push.example/2"),
		);
	});

	it("extracts the train from a key", () => {
		expect(trainOfKey("sub/0123456789abcdef/2026-10-27-9638")).toBe(
			"2026-10-27-9638",
		);
	});
});

describe("memory store", () => {
	it("keeps the old record when onlyIfMatch is stale", async () => {
		const store = createMemoryAlertStore();
		const key = recordKey("e", ref);
		await store.put(key, record("old"));
		const first = await store.get(key);
		await store.put(key, record("newer"));
		const accepted = await store.put(key, record("stale"), {
			onlyIfMatch: first?.etag,
		});
		expect(accepted).toBe(false);
		expect((await store.get(key))?.record.title).toBe("newer");
	});

	it("accepts a matching etag", async () => {
		const store = createMemoryAlertStore();
		const key = recordKey("e", ref);
		await store.put(key, record("one"));
		const current = await store.get(key);
		const accepted = await store.put(key, record("two"), {
			onlyIfMatch: current?.etag,
		});
		expect(accepted).toBe(true);
		expect((await store.get(key))?.record.title).toBe("two");
	});

	it("refuses a put with the old etag after delete", async () => {
		const store = createMemoryAlertStore();
		const key = recordKey("e", ref);
		await store.put(key, record());
		const current = await store.get(key);
		await store.delete(key);
		const accepted = await store.put(key, record(), {
			onlyIfMatch: current?.etag,
		});
		expect(accepted).toBe(false);
		expect(await store.get(key)).toBeNull();
	});

	it("lists every record key under a prefix", async () => {
		const store = createMemoryAlertStore();
		const a = recordKey("a", ref);
		const b = recordKey("b", { ...ref, trainNumber: 1 });
		await store.put(a, record());
		await store.put(b, record());
		await store.setMeta("meta/last-run", { at: "now" });
		const keys = (await store.list("sub/")).map((entry) => entry.key).sort();
		expect(keys).toEqual([a, b].sort());
	});
});
