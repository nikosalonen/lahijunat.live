/** @format */

import { useState } from "preact/hooks";

interface Toast {
  id: string;
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
}

export function useAnimatedToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    duration = 4000
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (message: string, duration?: number) =>
    addToast(message, "success", duration);

  const error = (message: string, duration?: number) =>
    addToast(message, "error", duration);

  const warning = (message: string, duration?: number) =>
    addToast(message, "warning", duration);

  const info = (message: string, duration?: number) =>
    addToast(message, "info", duration);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
