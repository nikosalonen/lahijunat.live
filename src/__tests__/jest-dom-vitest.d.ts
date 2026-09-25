// Vitest 5 changed `Assertion<T>` to `Assertion<R, T>`, so the augmentation
// shipped in @testing-library/jest-dom/vitest (7.0.1) no longer merges.
// Register the matchers on `Matchers<R, T>`, the interface Vitest 5 exposes
// for custom matcher types. Remove this once jest-dom ships Vitest 5 types.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
	interface Matchers<
		R extends void | Promise<void> = void | Promise<void>,
		T = unknown,
	> extends TestingLibraryMatchers<unknown, R> {}
}
