/** @format */

import { act, cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PassengerInfoCarousel from "@/components/PassengerInfoCarousel";
import type { ActiveMessage } from "@/utils/passengerInfo";

// Return distinguishable labels so the singular/plural station branch can be
// asserted unambiguously ("Asema" is a strict prefix of "Asemat").
vi.mock("@/utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			passengerInfoStation: "Asema",
			passengerInfoStations: "Asemat",
		};
		return translations[key] ?? key;
	},
}));

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

describe("PassengerInfoCarousel", () => {
	afterEach(() => {
		cleanup();
	});

	it("returns null when there are no messages", () => {
		const { container } = render(<PassengerInfoCarousel messages={[]} />);
		expect(container.innerHTML).toBe("");
	});

	it("renders a single message without carousel chrome", () => {
		const { container, queryByLabelText } = render(
			<PassengerInfoCarousel messages={[msg({ id: "a", text: "Only one" })]} />,
		);
		expect(container.textContent).toContain("Only one");
		// No prev/next paging controls for a single message.
		expect(queryByLabelText("passengerInfoPrev")).toBeNull();
		expect(queryByLabelText("passengerInfoNext")).toBeNull();
	});

	it("renders prev/next chrome when two or more messages are present", () => {
		const { queryByLabelText } = render(
			<PassengerInfoCarousel messages={[msg({ id: "a" }), msg({ id: "b" })]} />,
		);
		expect(queryByLabelText("passengerInfoPrev")).not.toBeNull();
		expect(queryByLabelText("passengerInfoNext")).not.toBeNull();
	});

	describe("station label pluralization", () => {
		it("uses the singular label for exactly one station", () => {
			const { container } = render(
				<PassengerInfoCarousel
					showStations
					messages={[msg({ id: "a", stationNames: ["Helsinki"] })]}
				/>,
			);
			expect(container.textContent).toContain("Asema: Helsinki");
			expect(container.textContent).not.toContain("Asemat");
		});

		it("uses the plural label for two or more stations", () => {
			const { container } = render(
				<PassengerInfoCarousel
					showStations
					messages={[msg({ id: "a", stationNames: ["Helsinki", "Pasila"] })]}
				/>,
			);
			expect(container.textContent).toContain("Asemat: Helsinki, Pasila");
		});

		it("omits the station line when stationNames is empty", () => {
			const { container } = render(
				<PassengerInfoCarousel
					showStations
					messages={[msg({ id: "a", stationNames: [] })]}
				/>,
			);
			expect(container.textContent).not.toContain("Asema");
		});

		it("omits the station line when showStations is not set", () => {
			const { container } = render(
				<PassengerInfoCarousel
					messages={[msg({ id: "a", stationNames: ["Helsinki"] })]}
				/>,
			);
			expect(container.textContent).not.toContain("Asema");
		});
	});

	describe("auto-advance", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("advances to the next message after the auto-advance interval", () => {
			const { container } = render(
				<PassengerInfoCarousel
					messages={[
						msg({ id: "a", text: "First message" }),
						msg({ id: "b", text: "Second message" }),
					]}
				/>,
			);
			expect(container.textContent).toContain("First message");

			// Auto-advance bumps the target index after 20s...
			act(() => {
				vi.advanceTimersByTime(20000);
			});
			// ...then the crossfade swaps the displayed message after the transition.
			act(() => {
				vi.advanceTimersByTime(400);
			});
			expect(container.textContent).toContain("Second message");
		});

		it("does not auto-advance a single message", () => {
			const { container } = render(
				<PassengerInfoCarousel messages={[msg({ id: "a", text: "Lonely" })]} />,
			);
			act(() => {
				vi.advanceTimersByTime(60000);
			});
			expect(container.textContent).toContain("Lonely");
		});
	});

	it("keeps the displayed message in range when the list shrinks", () => {
		const three = [msg({ id: "a" }), msg({ id: "b" }), msg({ id: "c" })];
		const { container, rerender } = render(
			<PassengerInfoCarousel messages={three} />,
		);

		// Shrink to a single message; the carousel must not read past the end.
		expect(() => {
			rerender(
				<PassengerInfoCarousel
					messages={[msg({ id: "a", text: "Survivor" })]}
				/>,
			);
		}).not.toThrow();
		expect(container.textContent).toContain("Survivor");
	});
});
