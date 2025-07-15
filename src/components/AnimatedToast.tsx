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
		const iconProps = {
			width: "20",
			height: "20",
			fill: "currentColor",
			"aria-hidden": true,
		};

		switch (type) {
			case "success":
				return (
					<svg {...iconProps} viewBox="0 0 20 20">
						<title>Success</title>
						<path
							fillRule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clipRule="evenodd"
						/>
					</svg>
				);
			case "error":
				return (
					<svg {...iconProps} viewBox="0 0 20 20">
						<title>Error</title>
						<path
							fillRule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clipRule="evenodd"
						/>
					</svg>
				);
			case "warning":
				return (
					<svg {...iconProps} viewBox="0 0 20 20">
						<title>Warning</title>
						<path
							fillRule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clipRule="evenodd"
						/>
					</svg>
				);
			default:
				return (
					<svg {...iconProps} viewBox="0 0 20 20">
						<title>Information</title>
						<path
							fillRule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
							clipRule="evenodd"
						/>
					</svg>
				);
		}
	};

	const getAriaAttributes = () => {
		// Use different ARIA attributes based on toast type for better accessibility
		switch (type) {
			case "error":
				return {
					role: "alert" as const,
					"aria-live": "assertive" as const, // Errors should interrupt screen readers
					"aria-atomic": true,
				};
			case "warning":
				return {
					role: "alert" as const,
					"aria-live": "assertive" as const, // Warnings should also interrupt
					"aria-atomic": true,
				};
			default:
				return {
					role: "status" as const,
					"aria-live": "polite" as const, // Success/info messages are less urgent
					"aria-atomic": true,
				};
		}
	};

	return (
		<div
			class={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ease-out transform ${
				isVisible && !isExiting
					? "translate-x-0 opacity-100 scale-100"
					: "translate-x-full opacity-0 scale-95"
			}`}
			{...getAriaAttributes()}
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
						aria-label="Close notification"
						class="flex-shrink-0 ml-3 text-lg opacity-70 hover:opacity-100 transition-opacity duration-150 focus-ring rounded p-1"
					>
						<svg
							width="16"
							height="16"
							fill="currentColor"
							viewBox="0 0 20 20"
							aria-hidden={true}
						>
							<path
								fillRule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clipRule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}
