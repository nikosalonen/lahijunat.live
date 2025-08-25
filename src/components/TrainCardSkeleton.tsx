/** @format */

export default function TrainCardSkeleton() {
	return (
		<output
			class="card bg-base-100 shadow-md border border-base-300 animate-scale-in"
			aria-live="polite"
			aria-label="Loading train information"
		>
			<div class="card-body p-4">
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center space-x-3">
						{/* Train number skeleton */}
						<div class="skeleton h-6 w-12" aria-hidden="true" />
						{/* Status skeleton */}
						<div class="skeleton h-4 w-16" aria-hidden="true" />
					</div>
					{/* Star icon skeleton */}
					<div class="skeleton h-5 w-5" aria-hidden="true" />
				</div>

				<div class="grid grid-cols-2 gap-4 text-sm">
					{/* Departure time */}
					<div>
						<div class="skeleton h-3 w-16 mb-1" aria-hidden="true" />
						<div class="skeleton h-5 w-12" aria-hidden="true" />
					</div>

					{/* Duration */}
					<div>
						<div class="skeleton h-3 w-12 mb-1" aria-hidden="true" />
						<div class="skeleton h-5 w-16" aria-hidden="true" />
					</div>

					{/* Track */}
					<div>
						<div class="skeleton h-3 w-10 mb-1" aria-hidden="true" />
						<div class="skeleton h-5 w-8" aria-hidden="true" />
					</div>

					{/* Delay info */}
					<div>
						<div class="skeleton h-3 w-14 mb-1" aria-hidden="true" />
						<div class="skeleton h-5 w-20" aria-hidden="true" />
					</div>
				</div>
			</div>
		</output>
	);
}
