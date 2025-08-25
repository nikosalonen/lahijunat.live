/** @format */

export default function TrainCardSkeleton() {
	return (
		<div class="card bg-base-100 shadow-md border border-base-300 animate-scale-in">
			<div class="card-body p-4">
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center space-x-3">
						{/* Train number skeleton */}
						<div class="skeleton h-6 w-12" />
						{/* Status skeleton */}
						<div class="skeleton h-4 w-16" />
					</div>
					{/* Star icon skeleton */}
					<div class="skeleton h-5 w-5" />
				</div>

				<div class="grid grid-cols-2 gap-4 text-sm">
					{/* Departure time */}
					<div>
						<div class="skeleton h-3 w-16 mb-1" />
						<div class="skeleton h-5 w-12" />
					</div>

					{/* Duration */}
					<div>
						<div class="skeleton h-3 w-12 mb-1" />
						<div class="skeleton h-5 w-16" />
					</div>

					{/* Track */}
					<div>
						<div class="skeleton h-3 w-10 mb-1" />
						<div class="skeleton h-5 w-8" />
					</div>

					{/* Delay info */}
					<div>
						<div class="skeleton h-3 w-14 mb-1" />
						<div class="skeleton h-5 w-20" />
					</div>
				</div>
			</div>
		</div>
	);
}
