/** @format */

import { useEffect, useState } from "preact/hooks";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onClose?: () => void;
}

// Animation timing constants to ensure JS and CSS stay in sync
const ANIMATION_DURATION = 300; // matches CSS transition duration-300

export default function AnimatedToast({
  message,
  type = "info",
  duration = 4000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after duration
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose?.(), ANIMATION_DURATION);
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-100";
      case "error":
        return "bg-red-50 border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-100";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-100";
      default:
        return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-100";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      default:
        return "ℹ";
    }
  };

  return (
    <div
      class={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ease-out transform ${
        isVisible && !isExiting
          ? "translate-x-0 opacity-100 scale-100"
          : "translate-x-full opacity-0 scale-95"
      }`}
    >
      <div
        class={`rounded-lg border shadow-lg p-4 ${getTypeStyles()} animate-bounce-subtle hover-lift`}
      >
        <div class="flex items-start">
          <div class="flex-shrink-0 text-lg mr-3 animate-scale-in">
            {getIcon()}
          </div>
          <div class="flex-1 text-sm font-medium animate-slide-up">
            {message}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsExiting(true);
              setTimeout(() => onClose?.(), ANIMATION_DURATION);
            }}
            class="flex-shrink-0 ml-3 text-lg opacity-70 hover:opacity-100 transition-opacity duration-150 focus-ring rounded"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
