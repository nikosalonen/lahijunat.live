import { renderHook } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { useValueChanged } from "../useValueChanged";

describe("useValueChanged", () => {
	it("returns false on initial render", () => {
		const { result } = renderHook(({ value }) => useValueChanged(value), {
			initialProps: { value: "10:00" },
		});
		expect(result.current).toBe(false);
	});

	it("returns false when re-rendered with the same value", () => {
		const { result, rerender } = renderHook(
			({ value }) => useValueChanged(value),
			{ initialProps: { value: "10:00" } },
		);
		rerender({ value: "10:00" });
		expect(result.current).toBe(false);
	});

	it("returns true after the value changes", () => {
		const { result, rerender } = renderHook(
			({ value }) => useValueChanged(value),
			{ initialProps: { value: "10:00" } },
		);
		rerender({ value: "10:05" });
		expect(result.current).toBe(true);
	});

	it("stays true after changing back to the original value", () => {
		const { result, rerender } = renderHook(
			({ value }) => useValueChanged(value),
			{ initialProps: { value: "10:00" } },
		);
		rerender({ value: "10:05" });
		rerender({ value: "10:00" });
		expect(result.current).toBe(true);
	});

	it("treats undefined initial values correctly", () => {
		const { result, rerender } = renderHook(
			({ value }: { value?: string }) => useValueChanged(value),
			{ initialProps: { value: undefined as string | undefined } },
		);
		expect(result.current).toBe(false);
		rerender({ value: "10:05" });
		expect(result.current).toBe(true);
	});
});
