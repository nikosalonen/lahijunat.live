// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { buildPushPayload, sendAlertPush } from "../sendPush";
import type { AlertPush, AlertRecord } from "../types";

vi.mock("web-push", () => ({
	default: { sendNotification: vi.fn() },
}));

const sendNotification = vi.mocked(webpush.sendNotification);

const record: AlertRecord = {
	endpoint: "https://fcm.googleapis.com/fcm/send/secret-endpoint",
	keys: { p256dh: "p-key", auth: "a-key" },
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
};

const push: AlertPush = {
	recordKey: "sub/abc/2026-10-27-9638",
	tag: "9638-2026-10-27-msg-1",
	title: "9638 Riihimäki → Helsinki",
	body: "Juna on myöhässä",
	url: "https://www.lahijunat.live/RI/HKI",
	lang: "fi",
	ttlSeconds: 3600,
	mark: { kind: "message", id: "msg-1", hash: "h" },
};

const env = {
	URL: "https://www.lahijunat.live",
	PUBLIC_VAPID_PUBLIC_KEY: "public-key",
	VAPID_PRIVATE_KEY: "private-key",
};

const pushError = (statusCode: number) =>
	Object.assign(new Error("push failed"), { statusCode });

describe("sendPush", () => {
	beforeEach(() => {
		sendNotification.mockReset();
		sendNotification.mockResolvedValue({
			statusCode: 201,
			body: "",
			headers: {},
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds the declarative payload", () => {
		expect(buildPushPayload(push)).toEqual({
			web_push: 8030,
			notification: {
				title: push.title,
				body: push.body,
				navigate: push.url,
				lang: "fi",
				tag: push.tag,
			},
		});
	});

	it("sends with TTL and high urgency", async () => {
		await expect(sendAlertPush(record, push, env)).resolves.toBe("sent");
		expect(sendNotification).toHaveBeenCalledWith(
			{ endpoint: record.endpoint, keys: record.keys },
			JSON.stringify(buildPushPayload(push)),
			{
				TTL: 3600,
				urgency: "high",
				timeout: 10_000,
				vapidDetails: {
					subject: "https://www.lahijunat.live",
					publicKey: "public-key",
					privateKey: "private-key",
				},
			},
		);
	});

	it("maps 410 to gone", async () => {
		sendNotification.mockRejectedValue(pushError(410));
		await expect(sendAlertPush(record, push, env)).resolves.toBe("gone");
	});

	it("maps 404 to gone", async () => {
		sendNotification.mockRejectedValue(pushError(404));
		await expect(sendAlertPush(record, push, env)).resolves.toBe("gone");
	});

	it("maps 413 to dropped", async () => {
		sendNotification.mockRejectedValue(pushError(413));
		await expect(sendAlertPush(record, push, env)).resolves.toBe("dropped");
	});

	it("maps 500 to failed", async () => {
		sendNotification.mockRejectedValue(pushError(500));
		await expect(sendAlertPush(record, push, env)).resolves.toBe("failed");
	});

	it("maps an error without a status code to failed", async () => {
		sendNotification.mockRejectedValue(new Error("network down"));
		await expect(sendAlertPush(record, push, env)).resolves.toBe("failed");
	});

	it("returns failed without sending when a VAPID key is missing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const noPrivate = { ...env, VAPID_PRIVATE_KEY: undefined };
		const noPublic = { ...env, PUBLIC_VAPID_PUBLIC_KEY: "" };
		await expect(sendAlertPush(record, push, noPrivate)).resolves.toBe(
			"failed",
		);
		await expect(sendAlertPush(record, push, noPublic)).resolves.toBe("failed");
		expect(sendNotification).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(
			"push send skipped: VAPID keys missing",
			expect.anything(),
		);
	});

	it("returns gone without sending for a non-allowlisted endpoint", async () => {
		const evil = { ...record, endpoint: "https://evil.example/push" };
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(sendAlertPush(evil, push, env)).resolves.toBe("gone");
		expect(sendNotification).not.toHaveBeenCalled();
	});

	it("returns gone for an http: endpoint", async () => {
		const plain = {
			...record,
			endpoint: "http://fcm.googleapis.com/fcm/send/abc",
		};
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(sendAlertPush(plain, push, env)).resolves.toBe("gone");
		expect(sendNotification).not.toHaveBeenCalled();
	});

	it("does not log the endpoint, keys, title or body", async () => {
		const spies = (["log", "info", "warn", "error"] as const).map((method) =>
			vi.spyOn(console, method).mockImplementation(() => {}),
		);
		sendNotification.mockRejectedValue(pushError(413));
		await sendAlertPush(record, push, env);
		sendNotification.mockRejectedValue(pushError(500));
		await sendAlertPush(record, push, env);

		const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
		expect(logged).toContain(push.tag);
		for (const secret of [
			record.endpoint,
			record.keys.p256dh,
			record.keys.auth,
			push.title,
			push.body,
		]) {
			expect(logged).not.toContain(secret);
		}
	});
});
