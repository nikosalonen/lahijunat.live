import { fireEvent, render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

	let defaultProps: {
		stations: Station[];
		onStationSelect: ReturnType<typeof vi.fn>;
		selectedValue: string | null;
		isOpen: boolean;
		onOpenChange: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		defaultProps = {
			stations: mockStations,
			onStationSelect: vi.fn(),
			selectedValue: null,
			isOpen: false,
			onOpenChange: vi.fn(),
		};
	});

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
		render(<StationList {...defaultProps} isOpen={true} />);

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

	describe("keyboard navigation", () => {
		it("opens dropdown when input receives focus", () => {
			render(<StationList {...defaultProps} />);

			const input = screen.getByRole("combobox");
			fireEvent.focus(input);

			expect(defaultProps.onOpenChange).toHaveBeenCalledWith(true);
		});

		it("closes dropdown when Escape key is pressed", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			fireEvent.keyDown(input, { key: "Escape" });

			expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
		});

		it("navigates down with Arrow Down key", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			fireEvent.keyDown(input, { key: "ArrowDown" });

			// First station should be highlighted
			const firstOption = screen.getByText("Helsinki (HKI)").closest("button");
			expect(firstOption).toHaveClass("bg-blue-100");
		});

		it("navigates up with Arrow Up key", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");

			// Navigate down first
			fireEvent.keyDown(input, { key: "ArrowDown" });
			fireEvent.keyDown(input, { key: "ArrowDown" });

			// Then navigate up
			fireEvent.keyDown(input, { key: "ArrowUp" });

			// First station should be highlighted again
			const firstOption = screen.getByText("Helsinki (HKI)").closest("button");
			expect(firstOption).toHaveClass("bg-blue-100");
		});

		it("cycles to end when pressing up from first item", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			fireEvent.keyDown(input, { key: "ArrowDown" }); // Select first
			fireEvent.keyDown(input, { key: "ArrowUp" }); // Go to last

			// Last station should be highlighted
			const lastOption = screen.getByText("Tampere (TPE)").closest("button");
			expect(lastOption).toHaveClass("bg-blue-100");
		});

		it("cycles to start when pressing down from last item", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			fireEvent.keyDown(input, { key: "ArrowDown" }); // First
			fireEvent.keyDown(input, { key: "ArrowDown" }); // Last
			fireEvent.keyDown(input, { key: "ArrowDown" }); // Cycle to first

			// First station should be highlighted
			const firstOption = screen.getByText("Helsinki (HKI)").closest("button");
			expect(firstOption).toHaveClass("bg-blue-100");
		});

		it("selects highlighted station with Enter key", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			fireEvent.keyDown(input, { key: "ArrowDown" }); // Highlight first
			fireEvent.keyDown(input, { key: "Enter" }); // Select

			expect(defaultProps.onStationSelect).toHaveBeenCalledWith(
				mockStations[0],
			);
			expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
		});

		it("opens dropdown when typing", () => {
			render(<StationList {...defaultProps} />);

			const input = screen.getByRole("combobox");
			fireEvent.input(input, { target: { value: "H" } });

			expect(defaultProps.onOpenChange).toHaveBeenCalledWith(true);
		});

		it("resets highlighted index when filtering changes", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");

			// Highlight second item
			fireEvent.keyDown(input, { key: "ArrowDown" });
			fireEvent.keyDown(input, { key: "ArrowDown" });

			// Filter stations
			fireEvent.input(input, { target: { value: "Hel" } });

			// First visible option should be highlighted after filtering
			fireEvent.keyDown(input, { key: "ArrowDown" });
			const helsinkiOption = screen
				.getByText("Helsinki (HKI)")
				.closest("button");
			expect(helsinkiOption).toHaveClass("bg-blue-100");
		});

		it("handles Tab key to close dropdown", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			fireEvent.keyDown(input, { key: "Tab" });

			expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
		});

		it("maintains keyboard navigation with filtered results", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");

			// Filter to show only Helsinki
			fireEvent.input(input, { target: { value: "Hel" } });

			// Navigate with arrows should only work on visible options
			fireEvent.keyDown(input, { key: "ArrowDown" });
			fireEvent.keyDown(input, { key: "ArrowDown" }); // Should not move to hidden option

			const helsinkiOption = screen
				.getByText("Helsinki (HKI)")
				.closest("button");
			expect(helsinkiOption).toHaveClass("bg-blue-100");
		});

		it("handles empty filtered results", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");

			// Filter with no matches
			fireEvent.input(input, { target: { value: "xyz" } });

			// Arrow keys should not crash
			fireEvent.keyDown(input, { key: "ArrowDown" });
			fireEvent.keyDown(input, { key: "ArrowUp" });
			fireEvent.keyDown(input, { key: "Enter" });

			// Should not call onStationSelect
			expect(defaultProps.onStationSelect).not.toHaveBeenCalled();
		});
	});

	describe("accessibility", () => {
		it("has proper ARIA attributes", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			expect(input).toHaveAttribute("aria-expanded", "true");
			expect(input).toHaveAttribute("aria-autocomplete", "list");

			const listbox = screen.getByTestId("station-listbox");
			expect(listbox).toBeInTheDocument();

			const options = screen.getAllByRole("option");
			expect(options).toHaveLength(2);
		});

		it("updates aria-expanded when dropdown state changes", () => {
			const { rerender } = render(
				<StationList {...defaultProps} isOpen={false} />,
			);

			const input = screen.getByRole("combobox");
			expect(input).toHaveAttribute("aria-expanded", "false");

			rerender(<StationList {...defaultProps} isOpen={true} />);
			expect(input).toHaveAttribute("aria-expanded", "true");
		});

		it("sets aria-activedescendant for highlighted option", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");
			fireEvent.keyDown(input, { key: "ArrowDown" });

			// Should have aria-activedescendant pointing to highlighted option
			const activedescendant = input.getAttribute("aria-activedescendant");
			expect(activedescendant).toBeTruthy();

			const highlightedOption = document.getElementById(activedescendant!);
			expect(highlightedOption).toHaveTextContent("Helsinki (HKI)");
		});

		it("has proper option IDs for screen readers", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const options = screen.getAllByRole("option");
			options.forEach((option, index) => {
				expect(option).toHaveAttribute("id");
				expect(option.id).toContain(`option-${index}`);
			});
		});

		it("announces loading state to screen readers", () => {
			render(<StationList {...defaultProps} isLoading={true} />);

			expect(screen.getByText("Ladataan...")).toBeInTheDocument();
		});

		it("provides clear feedback for selection", () => {
			render(<StationList {...defaultProps} selectedValue="HKI" />);

			const input = screen.getByRole("combobox") as HTMLInputElement;
			expect(input.value).toBe("Helsinki (HKI)");
		});
	});

	describe("edge cases", () => {
		it("handles empty stations array", () => {
			render(<StationList {...defaultProps} stations={[]} isOpen={true} />);

			// Should not crash and should show no options
			const listbox = screen.queryByTestId("station-listbox");
			expect(listbox).toBeInTheDocument();

			const options = screen.queryAllByRole("option");
			expect(options).toHaveLength(0);
		});

		it("handles stations with missing data", () => {
			const malformedStations = [
				{ name: "", shortCode: "TST", location: { latitude: 0, longitude: 0 } },
				{
					name: "Test",
					shortCode: "",
					location: { latitude: 0, longitude: 0 },
				},
			];

			render(
				<StationList
					{...defaultProps}
					stations={malformedStations}
					isOpen={true}
				/>,
			);

			// Should render without crashing
			const listbox = screen.getByTestId("station-listbox");
			expect(listbox).toBeInTheDocument();
		});

		it("handles very long station names gracefully", () => {
			const longNameStations = [
				{
					name: "Very Long Station Name That Should Be Truncated Properly",
					shortCode: "VLN",
					location: { latitude: 60.1699, longitude: 24.9384 },
				},
			];

			render(
				<StationList
					{...defaultProps}
					stations={longNameStations}
					isOpen={true}
				/>,
			);

			expect(screen.getByText(/Very Long Station Name/)).toBeInTheDocument();
		});

		it("handles rapid input changes", () => {
			render(<StationList {...defaultProps} isOpen={true} />);

			const input = screen.getByRole("combobox");

			// Rapid typing simulation
			fireEvent.input(input, { target: { value: "H" } });
			fireEvent.input(input, { target: { value: "He" } });
			fireEvent.input(input, { target: { value: "Hel" } });

			// Should show filtered results for 'Hel'
			expect(screen.getByText("Helsinki (HKI)")).toBeInTheDocument();

			fireEvent.input(input, { target: { value: "Hell" } });

			// Should not crash and should not show Helsinki for 'Hell'
			expect(screen.queryByText("Helsinki (HKI)")).not.toBeInTheDocument();
		});

		it("handles special characters in search", () => {
			const specialStations = [
				{
					name: "Åbo",
					shortCode: "ÅBO",
					location: { latitude: 60.1699, longitude: 24.9384 },
				},
			];

			render(
				<StationList
					{...defaultProps}
					stations={specialStations}
					isOpen={true}
				/>,
			);

			const input = screen.getByRole("combobox");
			fireEvent.input(input, { target: { value: "Å" } });

			expect(screen.getByText("Åbo (ÅBO)")).toBeInTheDocument();
		});
	});
});
