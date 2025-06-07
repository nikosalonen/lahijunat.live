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

		const spinner = container.querySelector("div");
		expect(spinner).toHaveClass("animate-spin");
		expect(spinner).toHaveClass("rounded-full");
		expect(spinner).toHaveClass("h-16");
		expect(spinner).toHaveClass("w-16");
		expect(spinner).toHaveClass("border-t-2");
		expect(spinner).toHaveClass("border-b-2");
		expect(spinner).toHaveClass("border-blue-500");
	});

	it("renders with correct accessibility attributes", () => {
		const { container } = render(<LoadingSpinner />);

		const spinner = container.querySelector("div");
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
