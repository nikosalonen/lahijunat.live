/** @format */

import TrainCardSkeleton from "./TrainCardSkeleton";

interface Props {
	count?: number;
}

export default function TrainListSkeleton({ count = 5 }: Props) {
	return (
		<output
			class="max-w-4xl mx-auto space-y-6 px-0 sm:px-4 animate-slide-up"
			aria-busy="true"
		>
			{/* Desktop header skeleton */}
			<div class="hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-2 px-2">
				<div class="skeleton h-8 w-64 order-2 sm:order-1" aria-hidden="true" />
				<div
					class="skeleton rounded-full h-6 w-6 self-end sm:self-auto order-1 sm:order-2"
					aria-hidden="true"
				/>
			</div>

			{/* Mobile progress skeleton */}
			<div class="sm:hidden flex justify-end mb-4 px-2" aria-hidden="true">
				<div class="skeleton rounded-full h-6 w-6" />
			</div>

			{/* Train cards skeleton */}
			<div class="grid auto-rows-fr gap-4 px-2">
				{Array.from({ length: count }, (_, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton items that don't reorder
						key={`train-skeleton-item-${index}`}
						class={`stagger-${Math.min(index + 1, 5)}`}
					>
						<TrainCardSkeleton />
					</div>
				))}
			</div>
		</output>
	);
}
