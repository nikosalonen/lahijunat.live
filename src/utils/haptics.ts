/**
 * Haptic feedback utility for mobile devices
 * Provides tactile feedback for user interactions
 *
 * @format
 */

export type HapticType =
  | "light"
  | "medium"
  | "heavy"
  | "selection"
  | "impact"
  | "notification";

/**
 * Extended Window interface for iOS DeviceMotionEvent
 */
interface WindowWithDeviceMotion extends Window {
  DeviceMotionEvent: {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
}

/**
 * Type guard to check if navigator has vibrate support
 */
const hasVibrateSupport = (navigator: Navigator): boolean => {
  return (
    "vibrate" in navigator && typeof (navigator as any).vibrate === "function"
  );
};

/**
 * Type guard to check if window has DeviceMotionEvent support
 */
const hasDeviceMotionSupport = (
  window: Window
): window is WindowWithDeviceMotion => {
  return (
    "DeviceMotionEvent" in window && window.DeviceMotionEvent !== undefined
  );
};

/**
 * Check if haptic feedback is supported
 */
export const isHapticSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    hasVibrateSupport(navigator)
  );
};

/**
 * Check if advanced haptics (iOS) are supported
 */
export const isAdvancedHapticSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    hasVibrateSupport(navigator) &&
    hasDeviceMotionSupport(window) &&
    typeof window.DeviceMotionEvent.requestPermission === "function"
  );
};

/**
 * Trigger haptic feedback
 */
export const triggerHaptic = (type: HapticType = "light"): void => {
  if (!isHapticSupported()) return;

  try {
    // Check if we have proper vibrate support
    if (!hasVibrateSupport(navigator)) return;

    // Cast navigator to access vibrate method safely
    const navigatorWithVibrate = navigator as Navigator & {
      vibrate: (pattern: number | number[]) => boolean;
    };

    // iOS enhanced patterns (if available)
    if (isAdvancedHapticSupported()) {
      const patterns: Record<HapticType, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 50,
        selection: [10, 10, 10],
        impact: 30,
        notification: [50, 50, 100],
      };

      navigatorWithVibrate.vibrate(patterns[type]);
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

    navigatorWithVibrate.vibrate(vibrationPatterns[type]);
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
