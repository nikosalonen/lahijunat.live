/** @format */

import { hapticLight } from "../utils/haptics";
import { t } from "../utils/translations";

export type ErrorType =
  | "network"
  | "api"
  | "location"
  | "notFound"
  | "rateLimit"
  | "generic";

interface Props {
  type: ErrorType;
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
  className?: string;
}

const getErrorConfig = (type: ErrorType) => {
  switch (type) {
    case "network":
      return {
        icon: (
          <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Network Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 109.75 9.75A9.75 9.75 0 0012 2.25z"
            />
          </svg>
        ),
        title: t("networkErrorTitle"),
        defaultMessage: t("networkErrorMessage"),
      };
    case "api":
      return {
        icon: (
          <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>API Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        ),
        title: t("apiErrorTitle"),
        defaultMessage: t("apiErrorMessage"),
      };
    case "location":
      return {
        icon: (
          <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Location Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        ),
        title: t("locationErrorTitle"),
        defaultMessage: t("locationErrorMessage"),
      };
    case "notFound":
      return {
        icon: (
          <svg
            className="h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Not Found</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        ),
        title: t("notFoundTitle"),
        defaultMessage: t("notFoundMessage"),
      };
    case "rateLimit":
      return {
        icon: (
          <svg
            className="h-12 w-12 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Rate Limit</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        title: t("rateLimitTitle"),
        defaultMessage: t("rateLimitMessage"),
      };
    default:
      return {
        icon: (
          <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        ),
        title: t("errorTitle"),
        defaultMessage: t("errorMessage"),
      };
  }
};

export default function ErrorState({
  type,
  message,
  onRetry,
  showRetry = true,
  className = "",
}: Props) {
  const config = getErrorConfig(type);
  const displayMessage = message || config.defaultMessage;

  const handleRetry = () => {
    hapticLight();
    onRetry?.();
  };

  return (
    <div className={`text-center p-4 sm:p-6 ${className}`}>
      <div className="mb-3 sm:mb-4 flex justify-center">{config.icon}</div>
      <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 px-2">
        {config.title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 max-w-xs sm:max-w-sm mx-auto px-2 leading-relaxed">
        {displayMessage}
      </p>
      {showRetry && onRetry && (
        <button
          type="button"
          onClick={handleRetry}
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
      )}
    </div>
  );
}
