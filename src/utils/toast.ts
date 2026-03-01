export type ToastType = "info" | "warning" | "error" | "success";

export interface ToastEvent {
	message: string;
	type: ToastType;
	duration?: number;
}

export function showToast(
	message: string,
	type: ToastType = "info",
	duration = 4000,
) {
	window.dispatchEvent(
		new CustomEvent<ToastEvent>("show-toast", {
			detail: { message, type, duration },
		}),
	);
}
