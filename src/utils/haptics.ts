/**
 * Haptic feedback utility for mobile devices
 * Provides tactile feedback for user interactions
 */

export type HapticType = "light" | "medium" | "heavy" | "selection" | "impact" | "notification";

/**
 * Check if haptic feedback is supported
 */
export const isHapticSupported = (): boolean => {
	return (
		typeof window !== "undefined" &&
		"navigator" in window &&
		"vibrate" in navigator
	);
};

/**
 * Check if advanced haptics (iOS) are supported
 */
export const isAdvancedHapticSupported = (): boolean => {
	return (
		typeof window !== "undefined" &&
		"navigator" in window &&
		// @ts-ignore - iOS specific API
		navigator.vibrate &&
		// @ts-ignore - iOS specific API
		window.DeviceMotionEvent &&
		// @ts-ignore - iOS specific API
		typeof DeviceMotionEvent.requestPermission === "function"
	);
};

/**
 * Trigger haptic feedback
 */
export const triggerHaptic = (type: HapticType = "light"): void => {
	if (!isHapticSupported()) return;

	try {
		// iOS Haptic Feedback API (if available)
		// @ts-ignore - iOS specific API
		if (window.navigator.vibrate && window.navigator.vibrate.length) {
			const patterns: Record<HapticType, number | number[]> = {
				light: 10,
				medium: 20,
				heavy: 50,
				selection: [10, 10, 10],
				impact: 30,
				notification: [50, 50, 100],
			};

			navigator.vibrate(patterns[type]);
			return;
		}

		// Fallback to standard vibration API
		const vibrationPatterns: Record<HapticType, number | number[]> = {
			light: 15,
			medium: 25,
			heavy: 40,
			selection: [10, 10, 10],
			impact: 30,
			notification: [100, 50, 100],
		};

		navigator.vibrate(vibrationPatterns[type]);
	} catch (error) {
		// Silently fail if haptics are not supported or blocked
		console.debug("Haptic feedback not available:", error);
	}
};

/**
 * Trigger light haptic feedback for button taps
 */
export const hapticLight = (): void => triggerHaptic("light");

/**
 * Trigger medium haptic feedback for selections
 */
export const hapticMedium = (): void => triggerHaptic("medium");

/**
 * Trigger heavy haptic feedback for important actions
 */
export const hapticHeavy = (): void => triggerHaptic("heavy");

/**
 * Trigger selection haptic feedback for list selections
 */
export const hapticSelection = (): void => triggerHaptic("selection");

/**
 * Trigger impact haptic feedback for confirmations
 */
export const hapticImpact = (): void => triggerHaptic("impact");

/**
 * Trigger notification haptic feedback for alerts
 */
export const hapticNotification = (): void => triggerHaptic("notification");
