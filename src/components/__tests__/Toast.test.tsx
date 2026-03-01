import { act, cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_EVENT, type ToastEvent } from "../../utils/toast";
import Toast from "../Toast";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			close: "Close",
		};
		return translations[key] || key;
	},
}));

function dispatchToast(
	message: string,
	type: ToastEvent["type"] = "info",
	duration?: number,
) {
	act(() => {
		window.dispatchEvent(
			new CustomEvent<ToastEvent>(TOAST_EVENT, {
				detail: { message, type, duration },
			}),
		);
	});
}

describe("Toast", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it("renders toast on event dispatch with role=alert", () => {
		const { queryByRole } = render(<Toast />);

		// No toast initially
		expect(queryByRole("alert")).toBeNull();

		dispatchToast("Hello world");

		const alert = queryByRole("alert");
		expect(alert).not.toBeNull();
		expect(alert?.textContent).toContain("Hello world");
	});

	it("applies correct alert class for info type", () => {
		const { queryByRole } = render(<Toast />);
		dispatchToast("Info message", "info");
		expect(queryByRole("alert")).toHaveClass("alert-info");
	});

	it("applies correct alert class for warning type", () => {
		const { queryByRole } = render(<Toast />);
		dispatchToast("Warning message", "warning");
		expect(queryByRole("alert")).toHaveClass("alert-warning");
	});

	it("applies correct alert class for error type", () => {
		const { queryByRole } = render(<Toast />);
		dispatchToast("Error message", "error");
		expect(queryByRole("alert")).toHaveClass("alert-error");
	});

	it("applies correct alert class for success type", () => {
		const { queryByRole } = render(<Toast />);
		dispatchToast("Success message", "success");
		expect(queryByRole("alert")).toHaveClass("alert-success");
	});

	it("auto-removes toast after duration", () => {
		const { queryAllByRole } = render(<Toast />);

		dispatchToast("Ephemeral", "info", 3000);
		expect(queryAllByRole("alert")).toHaveLength(1);

		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(queryAllByRole("alert")).toHaveLength(0);
	});

	it("removes toast on close button click", () => {
		const { queryAllByRole, getByLabelText } = render(<Toast />);

		dispatchToast("Dismissable");
		expect(queryAllByRole("alert")).toHaveLength(1);

		act(() => {
			getByLabelText("Close").click();
		});
		expect(queryAllByRole("alert")).toHaveLength(0);
	});

	it("caps at 4 visible toasts", () => {
		const { queryAllByRole } = render(<Toast />);

		for (let i = 1; i <= 6; i++) {
			dispatchToast(`Toast ${i}`);
		}

		expect(queryAllByRole("alert")).toHaveLength(4);
	});

	it("returns null when no toasts", () => {
		const { container } = render(<Toast />);
		expect(container.innerHTML).toBe("");
	});
});
