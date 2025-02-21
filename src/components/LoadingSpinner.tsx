export default function LoadingSpinner() {
	return (
		<output className="flex justify-center items-center h-screen">
			<div
				className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"
				aria-hidden="true"
			/>
			<span className="sr-only">Ladataan...</span>
		</output>
	);
}
