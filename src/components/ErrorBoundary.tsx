/** @format */

import { Component, type ComponentChildren } from "preact";
import { hapticNotification } from "../utils/haptics";
import { t } from "../utils/translations";

interface Props {
	children: ComponentChildren;
	fallback?: (error: Error, retry: () => void) => ComponentChildren;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<State> {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
		hapticNotification();

		this.setState({
			error,
			errorInfo: errorInfo.componentStack,
		});
	}

	handleRetry = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	render() {
		if (this.state.hasError && this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.handleRetry);
			}

			return (
				<div className="min-h-[200px] flex items-center justify-center p-4 sm:p-6">
					<div className="text-center max-w-xs sm:max-w-md w-full">
						<div className="mb-3 sm:mb-4">
							<svg
								className="mx-auto h-12 w-12 text-red-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
						</div>
						<h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 px-2">
							{t("errorTitle")}
						</h3>
						<p className="text-sm text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 px-2 leading-relaxed">
							{t("errorMessage")}
						</p>
						<button
							type="button"
							onClick={this.handleRetry}
							className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 touch-manipulation select-none active:scale-95 min-w-[120px] w-auto max-w-[200px]"
						>
							<svg
								className="mr-1.5 sm:mr-2 h-4 w-4 flex-shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							<span className="truncate">{t("retry")}</span>
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
