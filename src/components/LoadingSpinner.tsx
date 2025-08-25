/** @format */

import { t } from "../utils/translations";

export default function LoadingSpinner() {
	return (
		<div
			className="flex flex-col justify-center items-center h-screen animate-slide-up"
			role="progressbar"
			aria-live="polite"
			aria-busy="true"
			aria-label={t("loading")}
		>
			<span
				className="loading loading-spinner loading-lg text-primary"
				aria-hidden="true"
			/>
			<div className="mt-4 text-base-content/70 animate-bounce-subtle text-center">
				{t("loading")}
			</div>
		</div>
	);
}
