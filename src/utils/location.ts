interface Coordinates {
	latitude: number;
	longitude: number;
}

/**
 * Compute the haversine distance in kilometres between two geographic points.
 */
export function calculateDistance(
	coord1: Coordinates,
	coord2: Coordinates,
): number {
	const R = 6371; // Earth's radius in km
	const dLat = toRad(coord2.latitude - coord1.latitude);
	const dLon = toRad(coord2.longitude - coord1.longitude);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(coord1.latitude)) *
			Math.cos(toRad(coord2.latitude)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Convert degrees to radians for trigonometric calculations.
 */
function toRad(degrees: number): number {
	return degrees * (Math.PI / 180);
}

/**
 * Provide a loose bounding box for mainland Finland in decimal degrees.
 */
export function finlandBounds(): {
	minLat: number;
	maxLat: number;
	minLon: number;
	maxLon: number;
} {
	return {
		minLat: 59.7,
		maxLat: 70.1,
		minLon: 19.1,
		maxLon: 31.6,
	};
}

/**
 * Check whether the given coordinates fall within the Finland bounding box.
 */
export function isInFinland(coord: Coordinates): boolean {
	const bounds = finlandBounds();
	return (
		coord.latitude >= bounds.minLat &&
		coord.latitude <= bounds.maxLat &&
		coord.longitude >= bounds.minLon &&
		coord.longitude <= bounds.maxLon
	);
}
