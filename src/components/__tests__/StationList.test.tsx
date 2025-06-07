import { fireEvent, render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import type { Station } from "../../types";
import StationList from "../StationList";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			placeholder: "Hae asemaa",
			loading: "Ladataan...",
		};
		return translations[key] || key;
	},
}));

// Mock useLanguageChange hook
vi.mock("../hooks/useLanguageChange", () => ({
	useLanguageChange: vi.fn(),
}));

describe("StationList", () => {
	const mockStations: Station[] = [
		{
			name: "Helsinki",
			shortCode: "HKI",
			location: {
				latitude: 60.1699,
				longitude: 24.9384,
			},
		},
		{
			name: "Tampere",
			shortCode: "TPE",
			location: {
				latitude: 61.4978,
				longitude: 23.7609,
			},
		},
	];

	const defaultProps = {
		stations: mockStations,
		onStationSelect: vi.fn(),
		selectedValue: null,
		isOpen: false,
		onOpenChange: vi.fn(),
	};

	it("renders loading state when isLoading is true", () => {
		const { getByText } = render(
			<StationList {...defaultProps} isOpen={true} isLoading={true} />,
		);

		expect(getByText("Ladataan...")).toBeInTheDocument();
	});

	it("renders station list when not loading", () => {
		const { getByText } = render(
			<StationList {...defaultProps} isOpen={true} isLoading={false} />,
		);

		expect(getByText("Helsinki (HKI)")).toBeInTheDocument();
		expect(getByText("Tampere (TPE)")).toBeInTheDocument();
	});

	it("filters stations based on search term", () => {
		const { getByPlaceholderText, getByText, queryByText } = render(
			<StationList {...defaultProps} isOpen={true} />,
		);

		const input = getByPlaceholderText("Hae asemaa");
		fireEvent.input(input, { target: { value: "hel" } });

		expect(getByText("Helsinki (HKI)")).toBeInTheDocument();
		expect(queryByText("Tampere (TPE)")).not.toBeInTheDocument();
	});

	it("calls onStationSelect when a station is clicked", () => {
		const { getByText } = render(
			<StationList {...defaultProps} isOpen={true} />,
		);

		fireEvent.click(getByText("Helsinki (HKI)"));
		expect(defaultProps.onStationSelect).toHaveBeenCalledWith(mockStations[0]);
	});

	it("shows selected station in input when not open", () => {
		const { getByDisplayValue } = render(
			<StationList {...defaultProps} selectedValue="HKI" />,
		);

		expect(getByDisplayValue("Helsinki (HKI)")).toBeInTheDocument();
	});

	it("closes dropdown when clicking outside", () => {
		const { container } = render(
			<StationList {...defaultProps} isOpen={true} />,
		);

		fireEvent.mouseDown(document.body);
		expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
	});

	it("renders station options when isOpen is true", () => {
		const { getByText } = render(
			<StationList
				stations={mockStations}
				onStationSelect={() => {}}
				isOpen={true}
				onOpenChange={() => {}}
			/>,
		);
		expect(getByText("Helsinki (HKI)")).toBeInTheDocument();
		expect(getByText("Tampere (TPE)")).toBeInTheDocument();
	});
});
