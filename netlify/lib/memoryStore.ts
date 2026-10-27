import type { AlertStore } from "./store";
import type { AlertRecord } from "./types";

/** In-memory AlertStore for tests. Every write or delete moves the etag counter. */
export function createMemoryAlertStore(): AlertStore {
	const records = new Map<string, { etag: string; record: AlertRecord }>();
	const meta = new Map<string, unknown>();
	let counter = 0;
	const nextEtag = () => String(++counter);

	return {
		async list(prefix) {
			return [...records]
				.filter(([key]) => key.startsWith(prefix))
				.map(([key, { etag }]) => ({ key, etag }));
		},
		async get(key) {
			const found = records.get(key);
			return found ? { key, etag: found.etag, record: found.record } : null;
		},
		async put(key, record, opts) {
			if (
				opts?.onlyIfMatch !== undefined &&
				records.get(key)?.etag !== opts.onlyIfMatch
			) {
				return false;
			}
			records.set(key, { etag: nextEtag(), record: structuredClone(record) });
			return true;
		},
		async delete(key) {
			records.delete(key);
			nextEtag();
		},
		async setMeta(key, value) {
			meta.set(key, value);
		},
	};
}
