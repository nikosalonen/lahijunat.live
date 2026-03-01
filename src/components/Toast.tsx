import { useCallback, useEffect, useState } from "preact/hooks";
import { TOAST_EVENT, type ToastEvent, type ToastType } from "@/utils/toast";

interface ToastItem {
	id: number;
	message: string;
	type: ToastType;
	duration: number;
}

let nextId = 0;

const alertClass: Record<ToastType, string> = {
	info: "alert-info",
	warning: "alert-warning",
	error: "alert-error",
	success: "alert-success",
};

export default function Toast() {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	const removeToast = useCallback((id: number) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent<ToastEvent>).detail;
			const id = nextId++;
			const duration = detail.duration ?? 4000;
			setToasts((prev) => [
				...prev.slice(-3),
				{ id, message: detail.message, type: detail.type, duration },
			]);

			setTimeout(() => {
				removeToast(id);
			}, duration);
		};

		window.addEventListener(TOAST_EVENT, handler);
		return () => window.removeEventListener(TOAST_EVENT, handler);
	}, [removeToast]);

	if (toasts.length === 0) return null;

	return (
		<div className="toast toast-bottom toast-center z-[100] pb-safe mb-4">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={`alert ${alertClass[toast.type]} shadow-lg animate-slide-up text-sm py-2 px-4 min-h-0`}
					role="alert"
				>
					<span>{toast.message}</span>
					<button
						type="button"
						className="btn btn-ghost btn-xs"
						onClick={() => removeToast(toast.id)}
						aria-label="Close"
					>
						<svg
							className="w-3.5 h-3.5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			))}
		</div>
	);
}
