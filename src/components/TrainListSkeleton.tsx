/** @format */

import TrainCardSkeleton from "./TrainCardSkeleton";

interface Props {
	count?: number;
}

export default function TrainListSkeleton({ count = 5 }: Props) {
	return (
		<div class="max-w-4xl mx-auto space-y-6 px-0 sm:px-4 animate-slide-up">
			{/* Header skeleton */}
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2">
				<div class="bg-gray-200 dark:bg-gray-700 rounded h-8 w-64 shimmer-bg animate-shimmer order-2 sm:order-1" />
				<div class="bg-gray-200 dark:bg-gray-700 rounded-full h-6 w-6 shimmer-bg animate-shimmer self-end sm:self-auto order-1 sm:order-2" />
			</div>

			{/* Train cards skeleton */}
			<div class="grid auto-rows-fr gap-4 px-2">
				{Array.from({ length: count }, (_, index) => (
					<div
						key={`train-skeleton-${Date.now()}-${index}`}
						class={`stagger-${Math.min(index + 1, 5)}`}
					>
						<TrainCardSkeleton />
					</div>
				))}
			</div>
		</div>
	);
}
