/** @format */

import { t } from "../utils/translations";

export default function LoadingSpinner() {
  return (
    <output className="flex flex-col justify-center items-center h-screen animate-slide-up">
      <div className="relative">
        <div
          className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 animate-spin rounded-full h-16 w-16 border-l-2 border-r-2 border-purple-400 opacity-50"
          style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-4 text-gray-600 dark:text-gray-300 animate-bounce-subtle text-center">
        {t("loading")}
      </div>
      <span className="sr-only">{t("loading")}</span>
    </output>
  );
}
