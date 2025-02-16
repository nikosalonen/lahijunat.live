function ProgressCircle({ progress }: { progress: number }) {
	return (
		<div class="relative h-6 w-6">
			<svg class="transform -rotate-90 w-6 h-6" title="Progress indicator">
				<circle
					class="text-gray-200"
					stroke-width="2"
					stroke="currentColor"
					fill="transparent"
					r="10"
					cx="12"
					cy="12"
				/>
				<title>Seuraava lataus</title>
				<circle
					class="text-[#8c4799] transition-all duration-1000"
					stroke-width="4"
					stroke="currentColor"
					fill="transparent"
					r="10"
					cx="12"
					cy="12"
					style={{
						strokeDasharray: `${2 * Math.PI * 10}`,
						strokeDashoffset: `${2 * Math.PI * 10 * (1 - progress / 100)}`,
					}}
				/>
			</svg>
		</div>
	);
}

export default ProgressCircle;
