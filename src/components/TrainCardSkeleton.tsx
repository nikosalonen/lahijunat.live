/** @format */

export default function TrainCardSkeleton() {
	return (
		<output
			class="card bg-base-100 shadow-xl border border-base-300 rounded-xl animate-scale-in block"
			aria-label="Loading train information"
		>
			<div class="card-body p-3 sm:p-4">
				<div class="flex items-start justify-between gap-2 sm:gap-4">
					<div class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
						{/* Train line badge skeleton */}
						<div
							class="skeleton flex-shrink-0 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl"
							aria-hidden="true"
						/>

						{/* Main train info */}
						<div class="space-y-2 sm:space-y-1 min-w-0 flex-1">
							{/* Time display skeleton */}
							<div class="flex items-center gap-2">
								<div class="skeleton h-6 w-14" aria-hidden="true" />
								<div class="skeleton h-4 w-4 rounded-full" aria-hidden="true" />
								<div class="skeleton h-6 w-14" aria-hidden="true" />
							</div>
							{/* Duration skeleton */}
							<div class="skeleton h-4 w-20" aria-hidden="true" />
						</div>
					</div>

					{/* Right side: track and countdown */}
					<div class="flex flex-col items-end gap-2 sm:gap-3 flex-shrink-0">
						{/* Track badge skeleton */}
						<div class="skeleton h-8 w-20 rounded-full" aria-hidden="true" />
						{/* Countdown badge skeleton */}
						<div class="skeleton h-8 w-16 rounded-full" aria-hidden="true" />
					</div>
				</div>
			</div>
		</output>
	);
}
