/** @format */

import { act, cleanup, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AlertsToggle from "@/components/AlertsToggle";
import {
	ALERTS_STATE_EVENT,
	disableAllAlerts,
	enableAlerts,
	getAlertsPreference,
	getPushSupport,
	isAlertsFeatureEnabled,
	resyncAlerts,
} from "@/utils/pushAlerts";
import { showToast } from "@/utils/toast";

vi.mock("@/utils/translations", () => ({
	t: (key: string) => key,
}));

vi.mock("@/hooks/useLanguageChange", () => ({
	useLanguageChange: vi.fn(),
}));

vi.mock("@/utils/toast", () => ({
	showToast: vi.fn(),
}));

vi.mock("@/utils/pushAlerts", () => ({
	ALERTS_STATE_EVENT: "alerts-state-changed",
	disableAllAlerts: vi.fn(() => Promise.resolve()),
	enableAlerts: vi.fn(),
	getAlertsPreference: vi.fn(),
	getPushSupport: vi.fn(),
	isAlertsFeatureEnabled: vi.fn(),
	resyncAlerts: vi.fn(() => Promise.resolve()),
}));

function setPermission(permission: NotificationPermission) {
	vi.stubGlobal("Notification", { permission });
}

describe("AlertsToggle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(isAlertsFeatureEnabled).mockReturnValue(true);
		vi.mocked(getPushSupport).mockReturnValue("supported");
		vi.mocked(getAlertsPreference).mockReturnValue("on");
		setPermission("granted");
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("is hidden when push is unsupported", () => {
		vi.mocked(getPushSupport).mockReturnValue("unsupported");
		const { queryByRole } = render(<AlertsToggle />);
		expect(queryByRole("button")).not.toBeInTheDocument();
	});

	it("is hidden when the feature is disabled", () => {
		vi.mocked(isAlertsFeatureEnabled).mockReturnValue(false);
		const { queryByRole } = render(<AlertsToggle />);
		expect(queryByRole("button")).not.toBeInTheDocument();
	});

	it("shows on when the preference is on and permission is granted", () => {
		const { getByRole } = render(<AlertsToggle />);
		const button = getByRole("button", { name: "alertsToggleOn" });
		expect(button).toHaveAttribute("aria-pressed", "true");
	});

	it("shows off when permission is not granted", () => {
		setPermission("default");
		const { getByRole } = render(<AlertsToggle />);
		const button = getByRole("button", { name: "alertsToggleOff" });
		expect(button).toHaveAttribute("aria-pressed", "false");
	});

	it("shows on after alerts are enabled elsewhere", () => {
		setPermission("default");
		const { getByRole } = render(<AlertsToggle />);
		expect(getByRole("button")).toHaveAttribute("aria-pressed", "false");
		setPermission("granted");
		act(() => {
			window.dispatchEvent(new CustomEvent(ALERTS_STATE_EVENT));
		});
		expect(getByRole("button")).toHaveAttribute("aria-pressed", "true");
	});

	it("turns alerts off when on", async () => {
		const { getByRole } = render(<AlertsToggle />);
		act(() => {
			getByRole("button", { name: "alertsToggleOn" }).click();
		});
		expect(disableAllAlerts).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(
				getByRole("button", { name: "alertsToggleOff" }),
			).toBeInTheDocument();
		});
	});

	it("ignores clicks while turning alerts off is still running", async () => {
		let finishDisable: () => void = () => {};
		vi.mocked(disableAllAlerts).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishDisable = resolve;
				}),
		);
		const { getByRole } = render(<AlertsToggle />);
		const button = getByRole("button");

		act(() => {
			button.click();
		});
		expect(button).toBeDisabled();
		act(() => {
			button.click();
		});
		expect(enableAlerts).not.toHaveBeenCalled();

		await act(async () => {
			finishDisable();
		});
		expect(button).not.toBeDisabled();
	});

	it("turns alerts on and resyncs when off", async () => {
		vi.mocked(getAlertsPreference).mockReturnValue("off");
		vi.mocked(enableAlerts).mockResolvedValue("granted");
		const { getByRole } = render(<AlertsToggle />);
		act(() => {
			getByRole("button", { name: "alertsToggleOff" }).click();
		});
		await waitFor(() => {
			expect(resyncAlerts).toHaveBeenCalledTimes(1);
		});
		expect(enableAlerts).toHaveBeenCalledTimes(1);
	});

	it("shows the blocked toast when permission is denied", async () => {
		vi.mocked(getAlertsPreference).mockReturnValue("off");
		vi.mocked(enableAlerts).mockResolvedValue("denied");
		const { getByRole } = render(<AlertsToggle />);
		act(() => {
			getByRole("button", { name: "alertsToggleOff" }).click();
		});
		await waitFor(() => {
			expect(showToast).toHaveBeenCalledWith("alertsBlocked", "warning");
		});
		expect(resyncAlerts).not.toHaveBeenCalled();
	});

	it("stays off without a toast when the prompt is dismissed", async () => {
		vi.mocked(getAlertsPreference).mockReturnValue("off");
		vi.mocked(enableAlerts).mockResolvedValue("dismissed");
		const { getByRole } = render(<AlertsToggle />);
		act(() => {
			getByRole("button", { name: "alertsToggleOff" }).click();
		});
		await waitFor(() => {
			expect(getByRole("button")).not.toBeDisabled();
		});
		expect(getByRole("button")).toHaveAttribute("aria-pressed", "false");
		expect(showToast).not.toHaveBeenCalled();
		expect(resyncAlerts).not.toHaveBeenCalled();
	});
});
