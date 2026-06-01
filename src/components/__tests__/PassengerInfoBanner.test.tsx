/** @format */

import { act, cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PassengerInfoBanner from "@/components/PassengerInfoBanner";
import type { ActiveMessage } from "@/utils/passengerInfo";

vi.mock("@/utils/translations", () => ({
	t: (key: string) => key,
}));

const PREF_STORAGE_KEY = "passengerInfoPref";

function msg(over: Partial<ActiveMessage> & { id: string }): ActiveMessage {
	return {
		text: `Message ${over.id}`,
		trainNumber: null,
		trainDepartureDate: null,
		startValidity: "2026-06-01T00:00:00Z",
		endValidity: "2026-06-02T00:00:00Z",
		...over,
	};
}

describe("PassengerInfoBanner", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders nothing when there are no messages", () => {
		const { container } = render(<PassengerInfoBanner messages={[]} />);
		expect(container.innerHTML).toBe("");
	});

	it("renders the title and message count when messages are present", () => {
		const { container } = render(
			<PassengerInfoBanner messages={[msg({ id: "a" }), msg({ id: "b" })]} />,
		);
		expect(container.textContent).toContain("passengerInfoBannerTitle");
		expect(container.textContent).toContain("2");
	});

	it("expands to reveal the message when the header is clicked", () => {
		const { getByText, container } = render(
			<PassengerInfoBanner messages={[msg({ id: "a", text: "Hello" })]} />,
		);
		expect(container.textContent).not.toContain("Hello");
		act(() => {
			getByText("passengerInfoBannerTitle").click();
		});
		expect(container.textContent).toContain("Hello");
	});

	describe("dismissal flow", () => {
		it("opens a confirm prompt on the first close (no prior choice)", () => {
			const { getByLabelText, queryByRole } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			expect(queryByRole("dialog")).toBeNull();
			act(() => {
				getByLabelText("passengerInfoDismiss").click();
			});
			expect(queryByRole("dialog")).not.toBeNull();
		});

		it("persists a 'never' choice and hides the banner", () => {
			const { getByLabelText, getByText, container } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			act(() => {
				getByLabelText("passengerInfoDismiss").click();
			});
			act(() => {
				getByText("passengerInfoConfirmNever").click();
			});
			expect(container.innerHTML).toBe("");
			expect(window.localStorage.getItem(PREF_STORAGE_KEY)).toBe(
				JSON.stringify({ mode: "never" }),
			);
		});

		it("persists a 'daily' snooze and hides the banner", () => {
			const { getByLabelText, getByText, container } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			act(() => {
				getByLabelText("passengerInfoDismiss").click();
			});
			act(() => {
				getByText("passengerInfoConfirmDaily").click();
			});
			expect(container.innerHTML).toBe("");
			const stored = JSON.parse(
				window.localStorage.getItem(PREF_STORAGE_KEY) ?? "null",
			);
			expect(stored.mode).toBe("daily");
			expect(typeof stored.snoozedUntil).toBe("number");
			expect(stored.snoozedUntil).toBeGreaterThan(Date.now());
		});

		it("closing the prompt with cancel persists nothing and keeps the banner", () => {
			const { getByLabelText, getByText, container } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			act(() => {
				getByLabelText("passengerInfoDismiss").click();
			});
			act(() => {
				getByText("passengerInfoConfirmCancel").click();
			});
			expect(container.textContent).toContain("passengerInfoBannerTitle");
			expect(window.localStorage.getItem(PREF_STORAGE_KEY)).toBeNull();
		});

		it("re-arms the daily snooze silently on a subsequent close (no prompt)", () => {
			// A returning "daily" user whose snooze has already expired sees the
			// banner again; closing it should re-snooze without re-prompting.
			window.localStorage.setItem(
				PREF_STORAGE_KEY,
				JSON.stringify({ mode: "daily", snoozedUntil: Date.now() - 1000 }),
			);
			const { getByLabelText, queryByRole, container } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			expect(container.textContent).toContain("passengerInfoBannerTitle");
			act(() => {
				getByLabelText("passengerInfoDismiss").click();
			});
			// No confirm dialog this time...
			expect(queryByRole("dialog")).toBeNull();
			// ...and the banner is hidden with a fresh future snooze.
			expect(container.innerHTML).toBe("");
			const stored = JSON.parse(
				window.localStorage.getItem(PREF_STORAGE_KEY) ?? "null",
			);
			expect(stored.snoozedUntil).toBeGreaterThan(Date.now());
		});
	});

	describe("persisted preference on mount", () => {
		it("stays hidden when a 'never' choice was stored", () => {
			window.localStorage.setItem(
				PREF_STORAGE_KEY,
				JSON.stringify({ mode: "never" }),
			);
			const { container } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			expect(container.innerHTML).toBe("");
		});

		it("stays hidden while a daily snooze is still in the future", () => {
			window.localStorage.setItem(
				PREF_STORAGE_KEY,
				JSON.stringify({ mode: "daily", snoozedUntil: Date.now() + 3_600_000 }),
			);
			const { container } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			expect(container.innerHTML).toBe("");
		});

		it("shows again once a daily snooze has expired", () => {
			window.localStorage.setItem(
				PREF_STORAGE_KEY,
				JSON.stringify({ mode: "daily", snoozedUntil: Date.now() - 1000 }),
			);
			const { container } = render(
				<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
			);
			expect(container.textContent).toContain("passengerInfoBannerTitle");
		});
	});

	it("tolerates localStorage reads throwing and still shows the banner", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		const { container } = render(
			<PassengerInfoBanner messages={[msg({ id: "a" })]} />,
		);
		expect(container.textContent).toContain("passengerInfoBannerTitle");
	});
});
