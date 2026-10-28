/** @format */

import { act, cleanup, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PushAlerts from "@/components/PushAlerts";
import {
	ALERT_OPT_IN_EVENT,
	type AlertTarget,
	enableAlerts,
	resyncAlerts,
	snoozeOptIn,
	subscribeTrainAlerts,
} from "@/utils/pushAlerts";
import { showToast } from "@/utils/toast";

vi.mock("@/utils/translations", () => ({
	t: (key: string) => key,
}));

vi.mock("@/utils/toast", () => ({
	showToast: vi.fn(),
}));

vi.mock("@/hooks/useLanguageChange", () => ({
	useLanguageChange: vi.fn(),
}));

vi.mock("@/utils/pushAlerts", () => ({
	ALERT_OPT_IN_EVENT: "alert-opt-in",
	enableAlerts: vi.fn(),
	resyncAlerts: vi.fn(() => Promise.resolve()),
	snoozeOptIn: vi.fn(),
	subscribeTrainAlerts: vi.fn(() => Promise.resolve("ok")),
}));

const target: AlertTarget = {
	trainNumber: 123,
	departureDate: "2024-03-20",
	from: "HKI",
	to: "TPE",
	fromName: "Helsinki",
	toName: "Tampere",
	title: "A 12:00 Helsinki → Tampere",
	lang: "fi",
	cancelled: false,
};
const removeAfter = "2024-03-20T10:10:00.000Z";

function fireOptIn() {
	act(() => {
		window.dispatchEvent(
			new CustomEvent(ALERT_OPT_IN_EVENT, { detail: { target, removeAfter } }),
		);
	});
}

describe("PushAlerts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("resyncs on mount", () => {
		render(<PushAlerts />);
		expect(resyncAlerts).toHaveBeenCalledTimes(1);
	});

	it("renders nothing until the opt-in event arrives", () => {
		const { queryByRole } = render(<PushAlerts />);
		expect(queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("opens the prompt on the opt-in event", () => {
		const { getByRole, getByText } = render(<PushAlerts />);
		fireOptIn();
		expect(getByRole("dialog")).toBeInTheDocument();
		expect(getByText("alertsPromptTitle")).toBeInTheDocument();
		expect(getByText("alertsPromptBody")).toBeInTheDocument();
		expect(getByText("alertsPromptPrivacy")).toBeInTheDocument();
	});

	it("Yes enables alerts and subscribes the train", async () => {
		vi.mocked(enableAlerts).mockResolvedValue("granted");
		const { getByRole, queryByRole } = render(<PushAlerts />);
		fireOptIn();
		act(() => {
			getByRole("button", { name: "alertsPromptYes" }).click();
		});
		await waitFor(() => {
			expect(subscribeTrainAlerts).toHaveBeenCalledWith(target, removeAfter);
		});
		expect(enableAlerts).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(queryByRole("dialog")).not.toBeInTheDocument();
		});
	});

	it("Yes also registers earlier favorites after the train is subscribed", async () => {
		vi.mocked(enableAlerts).mockResolvedValue("granted");
		const { getByRole } = render(<PushAlerts />);
		vi.mocked(resyncAlerts).mockClear();
		fireOptIn();
		act(() => {
			getByRole("button", { name: "alertsPromptYes" }).click();
		});
		await waitFor(() => {
			expect(resyncAlerts).toHaveBeenCalledTimes(1);
		});
		expect(
			vi.mocked(subscribeTrainAlerts).mock.invocationCallOrder[0],
		).toBeLessThan(vi.mocked(resyncAlerts).mock.invocationCallOrder[0]);
	});

	it("Yes does not register other favorites when the server is full", async () => {
		vi.mocked(enableAlerts).mockResolvedValue("granted");
		vi.mocked(subscribeTrainAlerts).mockResolvedValueOnce("full");
		const { getByRole } = render(<PushAlerts />);
		vi.mocked(resyncAlerts).mockClear();
		fireOptIn();
		act(() => {
			getByRole("button", { name: "alertsPromptYes" }).click();
		});
		await waitFor(() => {
			expect(subscribeTrainAlerts).toHaveBeenCalledTimes(1);
		});
		expect(resyncAlerts).not.toHaveBeenCalled();
	});

	it("Yes closes without subscribing when permission is denied", async () => {
		vi.mocked(enableAlerts).mockResolvedValue("denied");
		const { getByRole, queryByRole } = render(<PushAlerts />);
		fireOptIn();
		act(() => {
			getByRole("button", { name: "alertsPromptYes" }).click();
		});
		await waitFor(() => {
			expect(queryByRole("dialog")).not.toBeInTheDocument();
		});
		expect(subscribeTrainAlerts).not.toHaveBeenCalled();
	});

	it("Yes shows the blocked toast when permission is denied", async () => {
		vi.mocked(enableAlerts).mockResolvedValue("denied");
		const { getByRole } = render(<PushAlerts />);
		fireOptIn();
		act(() => {
			getByRole("button", { name: "alertsPromptYes" }).click();
		});
		await waitFor(() => {
			expect(showToast).toHaveBeenCalledWith("alertsBlocked", "warning");
		});
	});

	it("Yes shows no toast when the prompt is dismissed", async () => {
		vi.mocked(enableAlerts).mockResolvedValue("dismissed");
		const { getByRole, queryByRole } = render(<PushAlerts />);
		fireOptIn();
		act(() => {
			getByRole("button", { name: "alertsPromptYes" }).click();
		});
		await waitFor(() => {
			expect(enableAlerts).toHaveBeenCalledTimes(1);
		});
		await waitFor(() => {
			expect(queryByRole("dialog")).not.toBeInTheDocument();
		});
		expect(showToast).not.toHaveBeenCalled();
		expect(subscribeTrainAlerts).not.toHaveBeenCalled();
	});

	it("Not now snoozes and closes", () => {
		const { getByRole, queryByRole } = render(<PushAlerts />);
		fireOptIn();
		act(() => {
			getByRole("button", { name: "alertsPromptNotNow" }).click();
		});
		expect(snoozeOptIn).toHaveBeenCalledTimes(1);
		expect(queryByRole("dialog")).not.toBeInTheDocument();
	});
});
