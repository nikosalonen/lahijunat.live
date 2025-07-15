/** @format */

import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import ErrorState from "../ErrorState";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			networkErrorTitle: "Connection Error",
			networkErrorMessage: "Check your internet connection and try again.",
			apiErrorTitle: "Service Error",
			apiErrorMessage:
				"Failed to load train data. Please try again in a moment.",
			locationErrorTitle: "Location Error",
			locationErrorMessage:
				"Could not determine location. Check location settings.",
			notFoundTitle: "No Results",
			notFoundMessage: "No trains found matching your search criteria.",
			rateLimitTitle: "Too Many Requests",
			rateLimitMessage: "Please wait a moment before searching again.",
			errorTitle: "Something Went Wrong",
			errorMessage: "An unexpected error occurred. Try refreshing the page.",
			retry: "Try Again",
		};
		return translations[key] || key;
	},
}));

// Mock haptics
vi.mock("../../utils/haptics", () => ({
	hapticLight: vi.fn(),
}));

describe("ErrorState", () => {
	it("renders network error correctly", () => {
		render(<ErrorState type="network" />);

		expect(screen.getByText("Connection Error")).toBeInTheDocument();
		expect(
			screen.getByText("Check your internet connection and try again."),
		).toBeInTheDocument();
	});

	it("renders API error correctly", () => {
		render(<ErrorState type="api" />);

		expect(screen.getByText("Service Error")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Failed to load train data. Please try again in a moment.",
			),
		).toBeInTheDocument();
	});

	it("renders location error correctly", () => {
		render(<ErrorState type="location" />);

		expect(screen.getByText("Location Error")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Could not determine location. Check location settings.",
			),
		).toBeInTheDocument();
	});

	it("renders not found error correctly", () => {
		render(<ErrorState type="notFound" />);

		expect(screen.getByText("No Results")).toBeInTheDocument();
		expect(
			screen.getByText("No trains found matching your search criteria."),
		).toBeInTheDocument();
	});

	it("renders rate limit error correctly", () => {
		render(<ErrorState type="rateLimit" />);

		expect(screen.getByText("Too Many Requests")).toBeInTheDocument();
		expect(
			screen.getByText("Please wait a moment before searching again."),
		).toBeInTheDocument();
	});

	it("renders generic error correctly", () => {
		render(<ErrorState type="generic" />);

		expect(screen.getByText("Something Went Wrong")).toBeInTheDocument();
		expect(
			screen.getByText(
				"An unexpected error occurred. Try refreshing the page.",
			),
		).toBeInTheDocument();
	});

	it("uses custom message when provided", () => {
		const customMessage = "Custom error message";
		render(<ErrorState type="network" message={customMessage} />);

		expect(screen.getByText("Connection Error")).toBeInTheDocument();
		expect(screen.getByText(customMessage)).toBeInTheDocument();
	});

	it("shows retry button by default", () => {
		const onRetry = vi.fn();
		render(<ErrorState type="network" onRetry={onRetry} />);

		const retryButton = screen.getByText("Try Again");
		expect(retryButton).toBeInTheDocument();
	});

	it("hides retry button when showRetry is false", () => {
		const onRetry = vi.fn();
		render(<ErrorState type="network" onRetry={onRetry} showRetry={false} />);

		expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
	});

	it("calls onRetry when retry button is clicked", () => {
		const onRetry = vi.fn();
		render(<ErrorState type="network" onRetry={onRetry} />);

		const retryButton = screen.getByText("Try Again");
		fireEvent.click(retryButton);

		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("applies custom className", () => {
		const customClass = "custom-error-class";
		const { container } = render(
			<ErrorState type="network" className={customClass} />,
		);

		expect(container.firstChild).toHaveClass(customClass);
	});

	it("doesn't show retry button when onRetry is not provided", () => {
		render(<ErrorState type="network" />);

		expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
	});

	it("has proper accessibility attributes", () => {
		const { container } = render(<ErrorState type="network" />);

		// Check for SVG icons with proper aria-hidden attribute
		const svgIcon = container.querySelector("svg");
		expect(svgIcon).toBeInTheDocument();
		expect(svgIcon).toHaveAttribute("aria-hidden", "true");
	});
});
