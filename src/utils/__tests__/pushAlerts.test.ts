import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Train } from "@/types";
import { getFavorites } from "@/utils/storage";
import { showToast } from "@/utils/toast";
import {
	ALERT_OPT_IN_EVENT,
	ALERTS_STATE_EVENT,
	type AlertTarget,
	buildAlertTarget,
	disableAllAlerts,
	getPushSupport,
	onFavoriteAdded,
	resyncAlerts,
	setAlertsPreference,
	snoozeOptIn,
	subscribeTrainAlerts,
} from "../pushAlerts";

vi.mock("@/utils/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/utils/storage", () => ({
	getFavorites: vi.fn(async () => ({})),
}));
vi.mock("@/utils/translations", () => ({ t: (key: string) => key }));

const target: AlertTarget = {
	trainNumber: 9,
	departureDate: "2026-10-27",
	from: "RI",
	to: "HKI",
	fromName: "Riihimäki",
	toName: "Helsinki",
	title: "R 08:25 Riihimäki → Helsinki",
	cancelled: false,
};
const removeAfter = "2026-10-27T08:40:00.000Z";

function makeTrain(overrides: Partial<Train> = {}): Train {
	const station = (name: string, shortCode: string) => ({
		name,
		shortCode,
		location: { latitude: 0, longitude: 0 },
	});
	const row = (
		type: string,
		code: string,
		name: string,
		scheduledTime: string,
	) => ({
		trainStopping: true,
		stationShortCode: code,
		type,
		commercialStop: true,
		commercialTrack: "1",
		cancelled: false,
		scheduledTime,
		station: station(name, code),
	});
	return {
		operatorUICCode: "10",
		trainCategory: "Commuter",
		trainType: "HL",
		cancelled: false,
		commuterLineID: "R",
		trainNumber: "9",
		timeTableRows: [
			row("DEPARTURE", "RI", "Riihimäki", "2026-10-27T06:25:00.000Z"),
			row("ARRIVAL", "HKI", "Helsinki", "2026-10-27T07:15:00.000Z"),
		],
		...overrides,
	};
}

function stubPush(permission: NotificationPermission) {
	const subscription = {
		endpoint: "https://fcm.googleapis.com/x",
		toJSON: () => ({
			endpoint: "https://fcm.googleapis.com/x",
			keys: { p256dh: "p", auth: "a" },
		}),
		unsubscribe: vi.fn(async () => true),
	};
	const pushManager = {
		getSubscription: vi.fn(async () => subscription),
		subscribe: vi.fn(async (_options?: PushSubscriptionOptionsInit) => {
			return subscription;
		}),
	};
	vi.stubGlobal("PushManager", class {});
	vi.stubGlobal("Notification", {
		permission,
		requestPermission: vi.fn(async () => permission),
	});
	Object.defineProperty(navigator, "serviceWorker", {
		configurable: true,
		value: { ready: Promise.resolve({ pushManager }) },
	});
	return { subscription, pushManager };
}

function stubFetch(status = 204, body: unknown = null) {
	const fetchMock = vi.fn(
		async () => new Response(body ? JSON.stringify(body) : null, { status }),
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function stubIPhone() {
	vi.stubGlobal("navigator", {
		userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
		maxTouchPoints: 5,
	});
}

function lastRequest(fetchMock: ReturnType<typeof stubFetch>) {
	const [url, init] = fetchMock.mock.calls[0] as unknown as [
		string,
		RequestInit,
	];
	return {
		url,
		method: init.method,
		headers: init.headers,
		body: JSON.parse(init.body as string),
	};
}

beforeEach(() => {
	vi.stubEnv("PUBLIC_VAPID_PUBLIC_KEY", "BAEC");
	window.localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.useRealTimers();
	vi.clearAllMocks();
	Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("buildAlertTarget", () => {
	it("uses originDepartureTime date", () => {
		const train = makeTrain({ originDepartureTime: "2026-10-26T22:10:00Z" });
		expect(buildAlertTarget(train, "RI", "HKI")?.departureDate).toBe(
			"2026-10-27",
		);
		const earlier = makeTrain({ originDepartureTime: "2026-10-26T21:50:00Z" });
		expect(buildAlertTarget(earlier, "RI", "HKI")?.departureDate).toBe(
			"2026-10-26",
		);
	});

	it("builds the title from line, Helsinki departure time and names", () => {
		expect(buildAlertTarget(makeTrain(), "RI", "HKI")).toEqual({
			trainNumber: 9,
			departureDate: "2026-10-27",
			from: "RI",
			to: "HKI",
			fromName: "Riihimäki",
			toName: "Helsinki",
			title: "R 08:25 Riihimäki → Helsinki",
			cancelled: false,
		});
	});

	it("marks the target cancelled when the train or its segment is cancelled", () => {
		expect(
			buildAlertTarget(makeTrain({ cancelled: true }), "RI", "HKI")?.cancelled,
		).toBe(true);
		const [from, to] = makeTrain().timeTableRows;
		const stopCancelled = makeTrain({
			timeTableRows: [{ ...from, cancelled: true }, to],
		});
		expect(buildAlertTarget(stopCancelled, "RI", "HKI")?.cancelled).toBe(true);
		const arrivalCancelled = makeTrain({
			timeTableRows: [from, { ...to, cancelled: true }],
		});
		expect(buildAlertTarget(arrivalCancelled, "RI", "HKI")?.cancelled).toBe(
			true,
		);
	});

	it("falls back to trainType and number without a line ID", () => {
		const built = buildAlertTarget(
			makeTrain({ commuterLineID: "" }),
			"RI",
			"HKI",
		);
		expect(built?.title).toBe("HL 9 08:25 Riihimäki → Helsinki");
	});

	it("returns null when a row is missing", () => {
		expect(buildAlertTarget(makeTrain(), "RI", "TPE")).toBeNull();
	});

	// The live-trains feed sends stationShortCode only, no station object.
	function makeLiveTrain(): Train {
		const train = makeTrain();
		return {
			...train,
			timeTableRows: train.timeTableRows.map(
				({ station: _station, ...row }) => row,
			),
		};
	}

	it("takes station names from the caller for live rows", () => {
		const built = buildAlertTarget(makeLiveTrain(), "RI", "HKI", {
			from: "Riihimäki",
			to: "Helsinki",
		});
		expect(built?.title).toBe("R 08:25 Riihimäki → Helsinki");
		expect(built?.fromName).toBe("Riihimäki");
	});

	it("falls back to station codes when no names are known", () => {
		expect(buildAlertTarget(makeLiveTrain(), "RI", "HKI")?.title).toBe(
			"R 08:25 RI → HKI",
		);
	});

	it("takes the title time from the second Pasila departure of a ring train", () => {
		const row = makeTrain().timeTableRows[0];
		const at = (
			type: string,
			code: string,
			name: string,
			scheduledTime: string,
		) => ({
			...row,
			type,
			stationShortCode: code,
			scheduledTime,
			station: {
				name,
				shortCode: code,
				location: { latitude: 0, longitude: 0 },
			},
		});
		const ring = makeTrain({
			commuterLineID: "I",
			timeTableRows: [
				at("DEPARTURE", "HKI", "Helsinki", "2026-10-27T05:20:00.000Z"),
				at("ARRIVAL", "PSL", "Pasila", "2026-10-27T05:25:00.000Z"),
				at("DEPARTURE", "PSL", "Pasila", "2026-10-27T05:26:00.000Z"),
				at("ARRIVAL", "LEN", "Lentoasema", "2026-10-27T05:50:00.000Z"),
				at("DEPARTURE", "LEN", "Lentoasema", "2026-10-27T05:51:00.000Z"),
				at("ARRIVAL", "PSL", "Pasila", "2026-10-27T06:24:00.000Z"),
				at("DEPARTURE", "PSL", "Pasila", "2026-10-27T06:25:00.000Z"),
				at("ARRIVAL", "HKI", "Helsinki", "2026-10-27T06:31:00.000Z"),
			],
		});
		expect(buildAlertTarget(ring, "PSL", "HKI")?.title).toBe(
			"I 08:25 Pasila → Helsinki",
		);
	});
});

describe("getPushSupport", () => {
	it("returns needs-home-screen on iPhone Safari without PushManager", () => {
		stubIPhone();
		expect(getPushSupport()).toBe("needs-home-screen");
	});

	it("returns unsupported on a desktop browser without push", () => {
		expect(getPushSupport()).toBe("unsupported");
	});

	it("returns supported when everything exists", () => {
		stubPush("default");
		expect(getPushSupport()).toBe("supported");
	});
});

describe("onFavoriteAdded", () => {
	it("dispatches the opt-in event when permission is default", async () => {
		stubPush("default");
		const listener = vi.fn();
		window.addEventListener(ALERT_OPT_IN_EVENT, listener);
		await onFavoriteAdded(target, removeAfter);
		window.removeEventListener(ALERT_OPT_IN_EVENT, listener);
		expect(listener).toHaveBeenCalledTimes(1);
		const event = listener.mock.calls[0][0] as CustomEvent;
		expect(event.detail).toEqual({ target, removeAfter });
	});

	it("does not dispatch while snoozed", async () => {
		stubPush("default");
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
		snoozeOptIn();
		const listener = vi.fn();
		window.addEventListener(ALERT_OPT_IN_EVENT, listener);

		vi.setSystemTime(new Date("2026-10-14T10:00:00Z"));
		await onFavoriteAdded(target, removeAfter);
		expect(listener).not.toHaveBeenCalled();

		vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));
		await onFavoriteAdded(target, removeAfter);
		window.removeEventListener(ALERT_OPT_IN_EVENT, listener);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("subscribes directly when permission is granted", async () => {
		stubPush("granted");
		const fetchMock = stubFetch();
		await onFavoriteAdded(target, removeAfter);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = lastRequest(fetchMock);
		expect(request.url).toBe("/api/alerts");
		expect(request.method).toBe("POST");
		expect(request.body).toMatchObject({
			...target,
			removeAfter,
			lang: "fi",
			subscription: { endpoint: "https://fcm.googleapis.com/x" },
		});
	});

	it("does nothing when permission is denied", async () => {
		stubPush("denied");
		const fetchMock = stubFetch();
		const listener = vi.fn();
		window.addEventListener(ALERT_OPT_IN_EVENT, listener);
		await onFavoriteAdded(target, removeAfter);
		window.removeEventListener(ALERT_OPT_IN_EVENT, listener);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
	});

	it("shows the home screen hint once", async () => {
		stubIPhone();
		await onFavoriteAdded(target, removeAfter);
		await onFavoriteAdded(target, removeAfter);
		expect(showToast).toHaveBeenCalledTimes(1);
		expect(showToast).toHaveBeenCalledWith("alertsHomeScreenHint", "info");
	});

	it("returns early when the preference is off", async () => {
		stubPush("granted");
		const fetchMock = stubFetch();
		window.localStorage.setItem("pushAlerts", "off");
		await onFavoriteAdded(target, removeAfter);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("subscribeTrainAlerts", () => {
	it("returns full and shows a toast on 503 full", async () => {
		stubPush("granted");
		stubFetch(503, { error: "full" });
		expect(await subscribeTrainAlerts(target, removeAfter)).toBe("full");
		expect(showToast).toHaveBeenCalledWith("alertsFull", "info");
	});

	it("returns error without throwing when fetch fails", async () => {
		stubPush("granted");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("offline");
			}),
		);
		expect(await subscribeTrainAlerts(target, removeAfter)).toBe("error");
	});

	it("returns error on other statuses", async () => {
		stubPush("granted");
		stubFetch(503, { error: "disabled" });
		expect(await subscribeTrainAlerts(target, removeAfter)).toBe("error");
	});

	it("returns ok on 204", async () => {
		stubPush("granted");
		stubFetch(204);
		expect(await subscribeTrainAlerts(target, removeAfter)).toBe("ok");
	});

	it("sends the POST as JSON", async () => {
		stubPush("granted");
		const fetchMock = stubFetch(204);
		await subscribeTrainAlerts(target, removeAfter);
		expect(lastRequest(fetchMock).headers).toEqual({
			"Content-Type": "application/json",
		});
	});

	it("replaces a subscription made with another VAPID key", async () => {
		const { subscription, pushManager } = stubPush("granted");
		Object.assign(subscription, {
			options: { applicationServerKey: new Uint8Array([9, 9, 9]).buffer },
		});
		stubFetch(204);
		expect(await subscribeTrainAlerts(target, removeAfter)).toBe("ok");
		expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
		expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
		// "BAEC" is the test key; it decodes to these bytes.
		const key = pushManager.subscribe.mock.calls[0][0]?.applicationServerKey;
		expect([...new Uint8Array(key as Uint8Array)]).toEqual([4, 1, 2]);
	});

	it("keeps a subscription made with the current VAPID key", async () => {
		const { subscription, pushManager } = stubPush("granted");
		Object.assign(subscription, {
			options: { applicationServerKey: new Uint8Array([4, 1, 2]).buffer },
		});
		stubFetch(204);
		await subscribeTrainAlerts(target, removeAfter);
		expect(subscription.unsubscribe).not.toHaveBeenCalled();
		expect(pushManager.subscribe).not.toHaveBeenCalled();
	});

	it("sends the cancelled flag in the POST body", async () => {
		stubPush("granted");
		const fetchMock = stubFetch(204);
		await subscribeTrainAlerts({ ...target, cancelled: true }, removeAfter);
		expect(lastRequest(fetchMock).body.cancelled).toBe(true);
	});
});

describe("resyncAlerts", () => {
	it("does nothing when permission is not granted", async () => {
		stubPush("default");
		const fetchMock = stubFetch();
		await resyncAlerts();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("posts every live favorite with an alertTarget", async () => {
		stubPush("granted");
		const fetchMock = stubFetch();
		const future = new Date(Date.now() + 3600_000).toISOString();
		const past = new Date(Date.now() - 3600_000).toISOString();
		vi.mocked(getFavorites).mockResolvedValue({
			"9": {
				highlighted: true,
				journeyKey: "a",
				removeAfter: future,
				alertTarget: target,
			},
			"10": {
				highlighted: true,
				journeyKey: "b",
				removeAfter: past,
				alertTarget: { ...target, trainNumber: 10 },
			},
			"11": { highlighted: true, journeyKey: "c", removeAfter: future },
		});
		await resyncAlerts();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(lastRequest(fetchMock).body).toMatchObject({
			trainNumber: 9,
			removeAfter: future,
		});
	});
});

describe("resyncAlerts without a subscription", () => {
	it("recreates a missing subscription even with no favorites", async () => {
		const { pushManager } = stubPush("granted");
		pushManager.getSubscription.mockResolvedValue(null as never);
		const fetchMock = stubFetch();
		vi.mocked(getFavorites).mockResolvedValue({});
		await resyncAlerts();
		expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("disableAllAlerts", () => {
	it("deletes all, unsubscribes and sets preference off", async () => {
		const { subscription } = stubPush("granted");
		const fetchMock = stubFetch();
		await disableAllAlerts();
		const request = lastRequest(fetchMock);
		expect(request.method).toBe("DELETE");
		expect(request.headers).toEqual({ "Content-Type": "application/json" });
		expect(request.body).toEqual({ endpoint: "https://fcm.googleapis.com/x" });
		expect(subscription.unsubscribe).toHaveBeenCalled();
		expect(window.localStorage.getItem("pushAlerts")).toBe("off");
	});
});

describe("setAlertsPreference", () => {
	it("setAlertsPreference dispatches the state event", () => {
		const listener = vi.fn();
		window.addEventListener(ALERTS_STATE_EVENT, listener);
		setAlertsPreference("on");
		window.removeEventListener(ALERTS_STATE_EVENT, listener);
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
