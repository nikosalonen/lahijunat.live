/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import { t } from "../utils/translations";

/**
 * Body of the 404 page: what happened and where to go next.
 *
 * An island so the copy follows the language switcher; Astro renders it at
 * build time, so the page is complete without JavaScript.
 */
export default function NotFoundPage() {
	useLanguageChange();

	return (
		<div class="text-center dark:text-white">
			<p
				aria-hidden="true"
				class="text-7xl sm:text-8xl font-black text-primary/30 leading-none mb-4"
			>
				404
			</p>
			<h1 class="text-2xl sm:text-3xl font-bold mb-3">
				{t("notFoundPageTitle")}
			</h1>
			<p class="text-base opacity-70 max-w-md mx-auto mb-8">
				{t("notFoundPageMessage")}
			</p>
			<nav
				aria-label={t("notFoundPageTitle")}
				class="flex flex-wrap justify-center gap-3"
			>
				<a href="/" class="btn btn-primary">
					{t("homePage")}
				</a>
				<a href="/asemat/" class="btn btn-outline">
					{t("allStations")}
				</a>
				<a href="/linjat/" class="btn btn-outline">
					{t("allLines")}
				</a>
			</nav>
		</div>
	);
}
