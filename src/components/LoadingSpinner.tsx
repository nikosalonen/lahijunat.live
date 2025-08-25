/** @format */

import { t } from "../utils/translations";

export default function LoadingSpinner() {
	return (
		<output className="flex flex-col justify-center items-center h-screen animate-slide-up">
			<span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
			<div className="mt-4 text-base-content/70 dark:text-base-content animate-bounce-subtle text-center">
				{t("loading")}
			</div>
			<span className="sr-only">{t("loading")}</span>
		</output>
	);
}
