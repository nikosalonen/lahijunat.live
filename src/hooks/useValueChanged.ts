import { useRef } from "preact/hooks";

/**
 * Returns false until the watched value changes after the initial render,
 * then true for the rest of the component's life. Used to gate one-shot
 * "value updated" animations so they never fire on first paint.
 */
export function useValueChanged<T>(value: T): boolean {
	const prevRef = useRef(value);
	const changedRef = useRef(false);
	if (prevRef.current !== value) {
		changedRef.current = true;
		prevRef.current = value;
	}
	return changedRef.current;
}
