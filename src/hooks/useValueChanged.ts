import { useRef } from "preact/hooks";

/**
 * Returns false until the watched value changes after the initial render,
 * then true for the rest of the component's life. Used to gate one-shot
 * "value updated" animations so they never fire on first paint.
 *
 * Comparison uses reference equality (`!==`), which works correctly for
 * primitives. Object or array values will latch `true` on any new reference,
 * even if the contents are identical — stabilise such values with useMemo
 * before passing them in.
 *
 * Refs are mutated in the render body rather than inside a useEffect so that
 * the changed flag is readable in the same render where the value changes.
 * This is safe because Preact 10 renders synchronously.
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
