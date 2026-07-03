import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOAST_EVENT = "show-toast";
const VERSION_STORAGE_KEY = "app-version";

type ToastDetail = { message: string; type: string; duration: number };

/**
 * Minimal ServiceWorkerContainer stand-in. Captures controllerchange
 * listeners so tests can simulate a new service worker taking control.
 */
function installServiceWorkerMock(initialController: object | null) {
	const listeners: Array<() => void> = [];
	const registration = { update: vi.fn() };
	const container = {
		controller: initialController,
		register: vi.fn().mockResolvedValue(registration),
		addEventListener: (type: string, cb: () => void) => {
			if (type === "controllerchange") listeners.push(cb);
		},
	};
	Object.defineProperty(navigator, "serviceWorker", {
		value: container,
		configurable: true,
	});
	return {
		container,
		fireControllerChange(newController: object) {
			container.controller = newController;
			for (const cb of listeners) cb();
		},
	};
}

/** Controller whose GET_VERSION reply reports the given stamped version. */
function makeController(version: string) {
	return {
		postMessage: (msg: { type?: string }, transfer?: MessagePort[]) => {
			if (msg?.type === "GET_VERSION" && transfer?.[0]) {
				transfer[0].postMessage({ version });
			}
		},
	};
}

/** Controller that never answers version requests (e.g. an old SW). */
function makeSilentController() {
	return { postMessage: vi.fn() };
}

function collectToasts() {
	const toasts: ToastDetail[] = [];
	const handler = (event: Event) => {
		toasts.push((event as CustomEvent<ToastDetail>).detail);
	};
	window.addEventListener(TOAST_EVENT, handler);
	return {
		toasts,
		dispose: () => window.removeEventListener(TOAST_EVENT, handler),
	};
}

async function importSwRegister() {
	vi.resetModules();
	// @ts-expect-error ts(2306): plain script with no exports, imported for its side effects
	await import("../../public/sw-register.js");
	// Let the register() promise chain settle.
	await Promise.resolve();
	await Promise.resolve();
}

async function flushMessages() {
	// MessagePort delivery is async; give it a couple of macrotasks.
	await new Promise((resolve) => setTimeout(resolve, 0));
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("sw-register update toast", () => {
	let toastCollector: ReturnType<typeof collectToasts>;

	beforeEach(() => {
		localStorage.clear();
		toastCollector = collectToasts();
	});

	afterEach(() => {
		toastCollector.dispose();
		vi.restoreAllMocks();
	});

	it("shows a toast when the new service worker reports a new base version", async () => {
		localStorage.setItem(VERSION_STORAGE_KEY, "1.18.0");
		const sw = installServiceWorkerMock(makeController("1.18.0"));
		await importSwRegister();

		sw.fireControllerChange(makeController("1.19.0"));
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(1);
		expect(toastCollector.toasts[0].type).toBe("success");
		expect(toastCollector.toasts[0].message).toBe(
			"Sovellus päivitettiin uusimpaan versioon",
		);
		expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe("1.19.0");
	});

	it("does not toast when the new service worker has the same base version", async () => {
		localStorage.setItem(VERSION_STORAGE_KEY, "1.18.0");
		const sw = installServiceWorkerMock(makeController("1.18.0"));
		await importSwRegister();

		sw.fireControllerChange(makeController("1.18.0"));
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(0);
	});

	it("treats a prerelease of the same base version as no update", async () => {
		localStorage.setItem(VERSION_STORAGE_KEY, "1.19.0-beta.1");
		const sw = installServiceWorkerMock(makeController("1.19.0-beta.1"));
		await importSwRegister();

		sw.fireControllerChange(makeController("1.19.0"));
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(0);
		expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe("1.19.0");
	});

	it("seeds the stored version silently when nothing is stored yet", async () => {
		const sw = installServiceWorkerMock(makeSilentController());
		await importSwRegister();

		sw.fireControllerChange(makeController("1.19.0"));
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(0);
		expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe("1.19.0");
	});

	it("seeds the stored version from the current controller on page load", async () => {
		installServiceWorkerMock(makeController("1.18.0"));
		await importSwRegister();
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(0);
		expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe("1.18.0");
	});

	it("does not toast on first install (no controller at page load)", async () => {
		const sw = installServiceWorkerMock(null);
		await importSwRegister();

		sw.fireControllerChange(makeController("1.19.0"));
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(0);
		expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe("1.19.0");
	});

	it("toasts once for a release that follows a silent deploy in the same session", async () => {
		localStorage.setItem(VERSION_STORAGE_KEY, "1.18.0");
		const sw = installServiceWorkerMock(makeController("1.18.0"));
		await importSwRegister();

		// Chore deploy: same version, new service worker.
		sw.fireControllerChange(makeController("1.18.0"));
		await flushMessages();
		expect(toastCollector.toasts).toHaveLength(0);

		// Real release later in the same page session.
		sw.fireControllerChange(makeController("1.19.0"));
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(1);
		expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe("1.19.0");
	});

	it("does not toast when the version request goes unanswered", async () => {
		localStorage.setItem(VERSION_STORAGE_KEY, "1.18.0");
		const sw = installServiceWorkerMock(makeController("1.18.0"));
		await importSwRegister();

		vi.useFakeTimers();
		sw.fireControllerChange(makeSilentController());
		await vi.advanceTimersByTimeAsync(5000);
		vi.useRealTimers();
		await flushMessages();

		expect(toastCollector.toasts).toHaveLength(0);
		expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe("1.18.0");
	});
});
