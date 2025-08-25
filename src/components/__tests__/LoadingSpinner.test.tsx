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

		const screenReaderText = container.querySelector(".sr-only");
		expect(screenReaderText).toBeInTheDocument();
		expect(screenReaderText).toHaveTextContent("Ladataan...");
	});

	it("renders in a centered container", () => {
		const { container } = render(<LoadingSpinner />);

		const output = container.querySelector("output");
		expect(output).toHaveClass("flex");
		expect(output).toHaveClass("justify-center");
		expect(output).toHaveClass("items-center");
		expect(output).toHaveClass("h-screen");
	});
});
