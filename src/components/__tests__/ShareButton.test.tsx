/** @format */

import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor,
} from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShareButton from "@/components/ShareButton";

vi.mock("@/utils/translations", () => ({
	t: (key: string) => key,
}));

vi.mock("@/utils/haptics", () => ({
	hapticLight: vi.fn(),
}));

// Mock the lazily-imported QR library so we can assert an SVG is rendered
// without depending on the real generator output. `qrState.shouldThrow` lets a
// test simulate the generator failing.
const qrState = vi.hoisted(() => ({ shouldThrow: false }));
vi.mock("qrcode-generator", () => ({
	default: () => ({
		addData: vi.fn(),
		make: vi.fn(),
		createSvgTag: () => {
			if (qrState.shouldThrow) throw new Error("qr generation failed");
			return '<svg data-testid="qr-svg"></svg>';
		},
	}),
}));

describe("ShareButton", () => {
	beforeEach(() => {
		qrState.shouldThrow = false;
		// jsdom location.origin defaults to http://localhost
		Object.assign(navigator, {
			clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		// Remove any share mock between tests
		(navigator as unknown as { share?: unknown }).share = undefined;
		// Reset the URL changed by route-specific tests
		window.history.pushState({}, "", "/");
	});

	it("renders a share button with an accessible label", () => {
		const { getByLabelText } = render(<ShareButton />);
		expect(getByLabelText("shareButtonLabel")).toBeInTheDocument();
	});

	it("opens the modal when the button is clicked", () => {
		const { getByLabelText, queryByRole, getByRole } = render(<ShareButton />);
		expect(queryByRole("dialog")).not.toBeInTheDocument();
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		expect(getByRole("dialog")).toBeInTheDocument();
	});

	it("closes the modal via the close button", () => {
		const { getByLabelText, getByRole, queryByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		act(() => {
			getByRole("button", { name: "closeShareModal" }).click();
		});
		expect(queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("closes the modal when Escape is pressed", () => {
		const { getByLabelText, queryByRole, getByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		act(() => {
			fireEvent.keyDown(getByRole("dialog"), { key: "Escape" });
		});
		expect(queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("renders the QR code SVG after opening", async () => {
		const { getByLabelText, findByTestId } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		expect(await findByTestId("qr-svg")).toBeInTheDocument();
	});

	it("shows a fallback and keeps the link usable when QR generation fails", async () => {
		qrState.shouldThrow = true;
		const { getByLabelText, findByText, queryByTestId, getByRole } = render(
			<ShareButton />,
		);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		expect(await findByText("qrCodeAlt")).toBeInTheDocument();
		expect(queryByTestId("qr-svg")).not.toBeInTheDocument();
		// Copy still works as a fallback path.
		expect(getByRole("button", { name: "copyLink" })).toBeInTheDocument();
	});

	it("copies the homepage URL and shows a success toast", async () => {
		const toastSpy = vi.fn();
		window.addEventListener("show-toast", toastSpy);
		const { getByLabelText, getByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		await act(async () => {
			getByRole("button", { name: "copyLink" }).click();
		});
		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				`${window.location.origin}/`,
			);
		});
		expect(toastSpy).toHaveBeenCalled();
		window.removeEventListener("show-toast", toastSpy);
	});

	it("does not show the share-target toggle on the homepage", () => {
		const { getByLabelText, queryByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		expect(
			queryByRole("button", { name: "shareCurrentView" }),
		).not.toBeInTheDocument();
		expect(
			queryByRole("button", { name: "shareHomepage" }),
		).not.toBeInTheDocument();
	});

	it("offers homepage and current-view options when viewing a route", () => {
		window.history.pushState({}, "", "/HKI/TKL");
		const { getByLabelText, getByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		expect(getByRole("button", { name: "shareHomepage" })).toBeInTheDocument();
		expect(
			getByRole("button", { name: "shareCurrentView" }),
		).toBeInTheDocument();
	});

	it("defaults to sharing the current view on a route page", async () => {
		window.history.pushState({}, "", "/HKI/TKL");
		const { getByLabelText, getByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		await act(async () => {
			getByRole("button", { name: "copyLink" }).click();
		});
		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				`${window.location.origin}/HKI/TKL`,
			);
		});
	});

	it("shares the homepage when the homepage option is chosen", async () => {
		window.history.pushState({}, "", "/HKI/TKL");
		const { getByLabelText, getByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		act(() => {
			getByRole("button", { name: "shareHomepage" }).click();
		});
		await act(async () => {
			getByRole("button", { name: "copyLink" }).click();
		});
		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				`${window.location.origin}/`,
			);
		});
	});

	it("hides the native share button when navigator.share is unavailable", () => {
		(navigator as unknown as { share?: unknown }).share = undefined;
		const { getByLabelText, queryByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		expect(
			queryByRole("button", { name: "nativeShare" }),
		).not.toBeInTheDocument();
	});

	it("invokes navigator.share with the homepage URL when supported", async () => {
		const shareMock = vi.fn().mockResolvedValue(undefined);
		(navigator as unknown as { share?: unknown }).share = shareMock;
		const { getByLabelText, getByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		await act(async () => {
			getByRole("button", { name: "nativeShare" }).click();
		});
		await waitFor(() => {
			expect(shareMock).toHaveBeenCalledWith(
				expect.objectContaining({ url: `${window.location.origin}/` }),
			);
		});
	});

	it("does not surface an error when the user cancels the native share", async () => {
		const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
		const shareMock = vi.fn().mockRejectedValue(abort);
		(navigator as unknown as { share?: unknown }).share = shareMock;
		const errorToast = vi.fn();
		window.addEventListener("show-toast", errorToast);
		const { getByLabelText, getByRole } = render(<ShareButton />);
		act(() => {
			getByLabelText("shareButtonLabel").click();
		});
		await act(async () => {
			getByRole("button", { name: "nativeShare" }).click();
		});
		await waitFor(() => expect(shareMock).toHaveBeenCalled());
		expect(errorToast).not.toHaveBeenCalled();
		window.removeEventListener("show-toast", errorToast);
	});
});
