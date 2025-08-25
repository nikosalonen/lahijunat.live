import { render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import LoadingSpinner from "../LoadingSpinner";

// Mock translations
vi.mock("../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			loading: "Ladataan...",
		};
		return translations[key] || key;
	},
}));

describe("LoadingSpinner", () => {
	it("renders spinner with correct classes", () => {
		const { container } = render(<LoadingSpinner />);

		const spinner = container.querySelector(".loading-spinner");
		expect(spinner).toHaveClass("loading");
		expect(spinner).toHaveClass("loading-spinner");
		expect(spinner).toHaveClass("loading-lg");
	});

	it("renders with correct accessibility attributes", () => {
		const { container } = render(<LoadingSpinner />);

		const spinner = container.querySelector(".loading-spinner");
		expect(spinner).toHaveAttribute("aria-hidden", "true");

		const progressContainer = container.querySelector('[role="progressbar"]');
		expect(progressContainer).toBeInTheDocument();
		expect(progressContainer).toHaveAttribute("aria-live", "polite");
		expect(progressContainer).toHaveAttribute("aria-busy", "true");
		expect(progressContainer).toHaveAttribute("aria-label", "Ladataan...");
	});

	it("renders in a centered container", () => {
		const { container } = render(<LoadingSpinner />);

		const container_element = container.querySelector('[role="progressbar"]');
		expect(container_element).toHaveClass("flex");
		expect(container_element).toHaveClass("justify-center");
		expect(container_element).toHaveClass("items-center");
		expect(container_element).toHaveClass("h-screen");
	});
});
