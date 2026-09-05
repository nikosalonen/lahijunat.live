/**
 * Digitraffic answers a live-trains route query that matches nothing with
 * HTTP 200 and an error object instead of an empty array:
 *
 *   { "errorMessage": "No trains found for route ...", "code": "TRAIN_NOT_FOUND", ... }
 *
 * That is a normal state for a station closed for track work or a route with
 * no service today, so treat it as an empty list. Any other non-array body is
 * still a broken response.
 */
export function parseLiveTrainsResponse<T = unknown>(data: unknown): T[] {
	if (Array.isArray(data)) return data as T[];

	if (
		typeof data === "object" &&
		data !== null &&
		(data as { code?: unknown }).code === "TRAIN_NOT_FOUND"
	) {
		return [];
	}

	throw new Error("Invalid API response format: expected an array");
}
