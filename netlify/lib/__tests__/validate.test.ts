// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	isAllowedPushEndpoint,
	parseDeleteBody,
	parseSubscribeBody,
} from "../validate";

const now = new Date("2026-10-27T10:00:00Z");

const body = (overrides: Record<string, unknown> = {}) => ({
	subscription: {
		endpoint: "https://fcm.googleapis.com/fcm/send/abc",
		keys: { p256dh: "BPabc-_123", auth: "xyz_-9==" },
	},
	trainNumber: 9638,
	departureDate: "2026-10-27",
	from: "HKI",
	to: "TPE",
	fromName: "Helsinki",
	toName: "Tampere",
	title: "IC 9638",
	lang: "fi",
	removeAfter: "2026-10-27T20:00:00Z",
	...overrides,
});

describe("isAllowedPushEndpoint", () => {
	it("accepts web.push.apple.com and fcm.googleapis.com", () => {
		expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
		expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/x")).toBe(
			true,
		);
	});

	it("rejects http: and example.com endpoints", () => {
		expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
		expect(isAllowedPushEndpoint("https://example.com/x")).toBe(false);
		expect(isAllowedPushEndpoint("https://evil.com/.push.apple.com")).toBe(
			false,
		);
		expect(isAllowedPushEndpoint("not a url")).toBe(false);
	});
});

describe("parseSubscribeBody", () => {
	it("accepts a valid body", () => {
		expect(parseSubscribeBody(body(), now).ok).toBe(true);
	});

	it("accepts yesterday's origin date", () => {
		expect(
			parseSubscribeBody(body({ departureDate: "2026-10-26" }), now).ok,
		).toBe(true);
	});

	it("rejects a date two days ago", () => {
		const result = parseSubscribeBody(
			body({ departureDate: "2026-10-25" }),
			now,
		);
		expect(result).toEqual({ ok: false, error: "invalid departureDate" });
	});

	it("accepts KÄP", () => {
		expect(parseSubscribeBody(body({ from: "KÄP" }), now).ok).toBe(true);
	});

	it("rejects lowercase codes", () => {
		expect(parseSubscribeBody(body({ to: "tpe" }), now)).toEqual({
			ok: false,
			error: "invalid to",
		});
	});

	it("rejects removeAfter more than 36 h ahead", () => {
		const result = parseSubscribeBody(
			body({ removeAfter: "2026-10-28T23:00:00Z" }),
			now,
		);
		expect(result).toEqual({ ok: false, error: "invalid removeAfter" });
	});

	it("rejects removeAfter in the past", () => {
		expect(
			parseSubscribeBody(body({ removeAfter: "2026-10-27T09:00:00Z" }), now).ok,
		).toBe(false);
	});

	it("rejects a 121-character title", () => {
		expect(parseSubscribeBody(body({ title: "x".repeat(121) }), now)).toEqual({
			ok: false,
			error: "invalid title",
		});
	});

	it("names the field but never echoes the bad value", () => {
		const result = parseSubscribeBody(
			body({
				subscription: { endpoint: "https://example.com/secret", keys: {} },
			}),
			now,
		);
		expect(result).toEqual({
			ok: false,
			error: "invalid subscription.endpoint",
		});
	});

	it("accepts an optional boolean cancelled flag", () => {
		const parsed = (over: Record<string, unknown>) => {
			const result = parseSubscribeBody(body(over), now);
			return result.ok ? result.value.cancelled : result.error;
		};
		expect(parsed({})).toBe(false);
		expect(parsed({ cancelled: false })).toBe(false);
		expect(parsed({ cancelled: true })).toBe(true);
		expect(parsed({ cancelled: "yes" })).toBe("invalid cancelled");
		expect(parsed({ cancelled: 1 })).toBe("invalid cancelled");
	});

	it("rejects bad keys, train numbers and languages", () => {
		const keys = { p256dh: "bad key!", auth: "a" };
		const endpoint = "https://fcm.googleapis.com/x";
		expect(
			parseSubscribeBody(body({ subscription: { endpoint, keys } }), now).ok,
		).toBe(false);
		expect(parseSubscribeBody(body({ trainNumber: 0 }), now).ok).toBe(false);
		expect(parseSubscribeBody(body({ trainNumber: 1.5 }), now).ok).toBe(false);
		expect(parseSubscribeBody(body({ lang: "de" }), now).ok).toBe(false);
	});
});

describe("parseDeleteBody", () => {
	const endpoint = "https://fcm.googleapis.com/fcm/send/abc";

	it("accepts an endpoint alone", () => {
		expect(parseDeleteBody({ endpoint })).toEqual({
			ok: true,
			value: { endpoint },
		});
	});

	it("accepts endpoint with train and date", () => {
		expect(
			parseDeleteBody({ endpoint, trainNumber: 1, departureDate: "2026-10-27" })
				.ok,
		).toBe(true);
	});

	it("rejects a train number without a date", () => {
		expect(parseDeleteBody({ endpoint, trainNumber: 1 }).ok).toBe(false);
	});
});

describe("hardened validation", () => {
	it.each([
		"https://fcm.googleapis.com:8443/x",
		"https://evil.com@fcm.googleapis.com/x",
		"https://fcm.googleapis.com@evil.com/x",
		"https://user:pw@fcm.googleapis.com/x",
		"https://fcm.googleapis.com.evil.com/x",
		"https://evil.com/?x=fcm.googleapis.com",
		"https://evil.com\\@fcm.googleapis.com/x",
		"https://fcm.googleapis.com/x y",
		"https://fcm.googleapis.com/x\n",
	])("rejects endpoint %j", (endpoint) => {
		expect(isAllowedPushEndpoint(endpoint)).toBe(false);
	});

	it("rejects a 1025-character endpoint", () => {
		const endpoint = `https://fcm.googleapis.com/${"a".repeat(1025 - 27)}`;
		expect(endpoint).toHaveLength(1025);
		expect(isAllowedPushEndpoint(endpoint)).toBe(false);
		expect(isAllowedPushEndpoint(endpoint.slice(0, 1024))).toBe(true);
	});

	it("stores the normalized endpoint href", () => {
		const result = parseSubscribeBody(
			body({
				subscription: {
					endpoint: "https://FCM.googleapis.com/fcm/send/AbC",
					keys: { p256dh: "a", auth: "b" },
				},
			}),
			now,
		);
		expect(result.ok && result.value.subscription.endpoint).toBe(
			"https://fcm.googleapis.com/fcm/send/AbC",
		);
	});

	it("rejects a non-ISO removeAfter", () => {
		expect(
			parseSubscribeBody(body({ removeAfter: "10/27/2026 20:00" }), now).ok,
		).toBe(false);
	});

	it("normalizes an offset removeAfter to UTC", () => {
		const result = parseSubscribeBody(
			body({ removeAfter: "2026-10-27T22:00:00+02:00" }),
			now,
		);
		expect(result.ok && result.value.removeAfter).toBe(
			"2026-10-27T20:00:00.000Z",
		);
	});

	it("uses Helsinki calendar days across a DST change", () => {
		const dst = new Date("2026-03-29T21:30:00Z"); // 2026-03-30 00:30 Helsinki
		const at = (departureDate: string) =>
			parseSubscribeBody(
				body({ departureDate, removeAfter: "2026-03-30T10:00:00Z" }),
				dst,
			).ok;
		expect(at("2026-03-29")).toBe(true);
		expect(at("2026-03-28")).toBe(false);
	});
});
