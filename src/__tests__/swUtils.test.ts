// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Handler = (event: unknown) => void;

type WindowClientStub = {
	focus: ReturnType<typeof vi.fn>;
	navigate: ReturnType<typeof vi.fn>;
};

const source = readFileSync(new URL("../sw-utils.js", import.meta.url), "utf8");

/** Runs sw-utils.js against a stubbed service worker global scope. */
function loadServiceWorker(openClients: WindowClientStub[] = []) {
	const handlers: Record<string, Handler> = {};
	const showNotification = vi.fn().mockResolvedValue(undefined);
	const matchAll = vi.fn().mockResolvedValue(openClients);
	const openWindow = vi.fn().mockResolvedValue(undefined);
	const self = {
		addEventListener: (type: string, handler: Handler) => {
			handlers[type] = handler;
		},
		skipWaiting: vi.fn(),
		registration: { showNotification },
		clients: { matchAll, openWindow },
	};
	runInNewContext(source, { self });
	return { handlers, showNotification, matchAll, openWindow };
}

/** Event whose waitUntil captures the promise so tests can await it. */
function makeEvent<T extends object>(extra: T) {
	let pending: Promise<unknown> = Promise.resolve();
	return {
		event: {
			...extra,
			waitUntil: (promise: Promise<unknown>) => {
				pending = promise;
			},
		},
		done: () => pending,
	};
}

function makeWindowClient(): WindowClientStub {
	return {
		focus: vi.fn().mockResolvedValue(undefined),
		navigate: vi.fn().mockResolvedValue(undefined),
	};
}

describe("sw-utils push handling", () => {
	it("push shows the notification from the payload", async () => {
		const { handlers, showNotification } = loadServiceWorker();
		const payload = {
			web_push: 8030,
			notification: {
				title: "Train delayed",
				body: "IC 27 is 5 min late",
				navigate: "/?from=HKI&to=TPE",
				lang: "en",
				tag: "IC27-2026-10-27",
			},
		};
		const { event, done } = makeEvent({ data: { json: () => payload } });

		handlers.push(event);
		await done();

		expect(showNotification).toHaveBeenCalledWith("Train delayed", {
			body: "IC 27 is 5 min late",
			tag: "IC27-2026-10-27",
			lang: "en",
			icon: "/icons/icon-192-maskable.png",
			data: { url: "/?from=HKI&to=TPE" },
		});
	});

	it("push shows a fallback notification for invalid JSON", async () => {
		const { handlers, showNotification } = loadServiceWorker();
		const { event, done } = makeEvent({
			data: {
				json: () => {
					throw new SyntaxError("Unexpected token");
				},
			},
		});

		handlers.push(event);
		await done();

		expect(showNotification).toHaveBeenCalledTimes(1);
		const [title, options] = showNotification.mock.calls[0];
		expect(title).toBe("Lähijunat");
		expect(options.body).toBe("");
		expect(options.data).toEqual({ url: "/" });
	});

	it("push shows a fallback notification when there is no data", async () => {
		const { handlers, showNotification } = loadServiceWorker();
		const { event, done } = makeEvent({ data: null });

		handlers.push(event);
		await done();

		expect(showNotification.mock.calls[0][0]).toBe("Lähijunat");
	});

	it("click focuses and navigates an open window", async () => {
		const windowClient = makeWindowClient();
		const { handlers, matchAll, openWindow } = loadServiceWorker([
			windowClient,
		]);
		const close = vi.fn();
		const { event, done } = makeEvent({
			notification: { close, data: { url: "/?from=HKI&to=TPE" } },
		});

		handlers.notificationclick(event);
		await done();

		expect(close).toHaveBeenCalled();
		expect(matchAll).toHaveBeenCalledWith({
			type: "window",
			includeUncontrolled: true,
		});
		expect(windowClient.focus).toHaveBeenCalled();
		expect(windowClient.navigate).toHaveBeenCalledWith("/?from=HKI&to=TPE");
		expect(openWindow).not.toHaveBeenCalled();
	});

	it("click opens a new window when navigate rejects", async () => {
		const windowClient = makeWindowClient();
		windowClient.navigate.mockRejectedValue(new TypeError("uncontrolled"));
		const { handlers, openWindow } = loadServiceWorker([windowClient]);
		const { event, done } = makeEvent({
			notification: { close: vi.fn(), data: { url: "/?from=HKI&to=TPE" } },
		});

		handlers.notificationclick(event);
		await done();

		expect(openWindow).toHaveBeenCalledWith("/?from=HKI&to=TPE");
	});

	it("click opens a new window when the client has no navigate", async () => {
		const windowClient = { focus: vi.fn().mockResolvedValue(undefined) };
		const { handlers, openWindow } = loadServiceWorker([
			windowClient as unknown as WindowClientStub,
		]);
		const { event, done } = makeEvent({
			notification: { close: vi.fn(), data: { url: "/?from=HKI&to=TPE" } },
		});

		handlers.notificationclick(event);
		await done();

		expect(openWindow).toHaveBeenCalledWith("/?from=HKI&to=TPE");
	});

	it("click opens a new window when none is open", async () => {
		const { handlers, openWindow } = loadServiceWorker([]);
		const { event, done } = makeEvent({
			notification: { close: vi.fn(), data: { url: "/?from=HKI&to=TPE" } },
		});

		handlers.notificationclick(event);
		await done();

		expect(openWindow).toHaveBeenCalledWith("/?from=HKI&to=TPE");
	});
});
