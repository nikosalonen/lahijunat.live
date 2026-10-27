import { fireEvent, render } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActiveMessage } from "../../utils/passengerInfo";
import TrainAnnouncements from "../TrainAnnouncements";

vi.mock("../../utils/translations", () => ({
	t: (key: string) => key,
}));

const message = (id: string, text: string): ActiveMessage => ({
	id,
	text,
	trainNumber: 9680,
	trainDepartureDate: "2026-10-27",
	startValidity: "2026-10-27T05:00:00.000Z",
	endValidity: "2026-10-29T00:00:00.000Z",
});

const unitMessage = message(
	"msg-1",
	"Ajetaan poikkeuksellisesti vain yhdellä junayksiköllä.",
);
const delayMessage = message("msg-2", "Juna on myöhässä teknisen vian vuoksi.");

/** jsdom does no layout, so fake the sizes a clamped paragraph would have. */
function simulateClampedText() {
	vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);
	vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
}

describe("TrainAnnouncements", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders nothing without messages", () => {
		const { container } = render(
			<TrainAnnouncements messages={[]} listId="list" />,
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("shows a short single announcement with no toggle", () => {
		const { getByText, queryByRole } = render(
			<TrainAnnouncements messages={[unitMessage]} listId="list" />,
		);

		expect(getByText(unitMessage.text)).toBeInTheDocument();
		expect(queryByRole("button")).not.toBeInTheDocument();
	});

	it("clamps the first announcement while closed", () => {
		const { getByText } = render(
			<TrainAnnouncements messages={[unitMessage]} listId="list" />,
		);

		// Three lines on the narrowest phones, two from 360px up
		expect(getByText(unitMessage.text)).toHaveClass(
			"line-clamp-3",
			"min-[360px]:line-clamp-2",
		);
	});

	it("offers a toggle when a long announcement is cut off", () => {
		simulateClampedText();
		const { getByRole, getByText } = render(
			<TrainAnnouncements messages={[unitMessage]} listId="list" />,
		);

		const toggle = getByRole("button");
		expect(toggle).toHaveAttribute("aria-expanded", "false");

		fireEvent.click(toggle);

		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(getByText(unitMessage.text).className).not.toMatch(/line-clamp/);
	});

	it("shows only the first of several announcements with a +N chip", () => {
		const { getByText, queryByText } = render(
			<TrainAnnouncements
				messages={[unitMessage, delayMessage]}
				listId="list"
			/>,
		);

		expect(getByText(unitMessage.text)).toBeInTheDocument();
		expect(getByText("+1")).toBeInTheDocument();
		expect(queryByText(delayMessage.text)).not.toBeInTheDocument();
	});

	it("shows every announcement once opened", () => {
		const { getByRole, getByText, queryByText } = render(
			<TrainAnnouncements
				messages={[unitMessage, delayMessage]}
				listId="list"
			/>,
		);

		fireEvent.click(getByRole("button"));

		expect(getByText(unitMessage.text)).toBeInTheDocument();
		expect(getByText(delayMessage.text)).toBeInTheDocument();
		expect(queryByText("+1")).not.toBeInTheDocument();
	});

	it("links the toggle to the announcement list", () => {
		const { getByRole } = render(
			<TrainAnnouncements
				messages={[unitMessage, delayMessage]}
				listId="train-9680-messages"
			/>,
		);

		expect(getByRole("button")).toHaveAttribute(
			"aria-controls",
			"train-9680-messages",
		);
		expect(getByRole("list")).toHaveAttribute("id", "train-9680-messages");
	});
});
