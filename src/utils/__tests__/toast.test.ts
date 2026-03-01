import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showToast, TOAST_EVENT } from "@/utils/toast";

describe("showToast", () => {
	let dispatchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dispatchSpy = vi.spyOn(window, "dispatchEvent");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("dispatches CustomEvent with correct detail", () => {
		showToast("Test message", "warning", 5000);

		expect(dispatchSpy).toHaveBeenCalledTimes(1);
		const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
		expect(event.type).toBe(TOAST_EVENT);
		expect(event.detail).toEqual({
			message: "Test message",
			type: "warning",
			duration: 5000,
		});
	});

	it("uses default duration of 4000", () => {
		showToast("Hello", "info");

		const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
		expect(event.detail.duration).toBe(4000);
	});

	it("uses default type of info", () => {
		showToast("Hello");

		const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
		expect(event.detail.type).toBe("info");
	});

	it("event name matches TOAST_EVENT constant", () => {
		expect(TOAST_EVENT).toBe("show-toast");
	});
});
