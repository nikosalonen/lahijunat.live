import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import type { AlertRecord, StoredRecord, TrainRef } from "./types";

export interface AlertStore {
	list(prefix: string): Promise<Array<{ key: string; etag: string }>>;
	get(key: string): Promise<StoredRecord | null>;
	/** Returns false when `onlyIfMatch` does not match the stored etag. */
	put(
		key: string,
		record: AlertRecord,
		opts?: { onlyIfMatch?: string },
	): Promise<boolean>;
	delete(key: string): Promise<void>;
	setMeta(key: string, value: unknown): Promise<void>;
}

/** "sub/<16 hex>/": all records of one device. The endpoint itself never appears in a key. */
export function endpointPrefix(endpoint: string): string {
	const hash = createHash("sha256").update(endpoint).digest("hex");
	return `sub/${hash.slice(0, 16)}/`;
}

export function recordKey(endpoint: string, ref: TrainRef): string {
	return `${endpointPrefix(endpoint)}${ref.departureDate}-${ref.trainNumber}`;
}

/** "sub/<hash>/2026-10-27-9638" -> "2026-10-27-9638" */
export function trainOfKey(key: string): string {
	return key.slice(key.lastIndexOf("/") + 1);
}

export function createBlobAlertStore(): AlertStore {
	const store = getStore({
		name: "push-alerts",
		region: "eu-central-1",
		consistency: "strong",
	});
	return {
		async list(prefix) {
			const { blobs } = await store.list({ prefix });
			return blobs.map(({ key, etag }) => ({ key, etag }));
		},
		async get(key) {
			const found = await store.getWithMetadata(key, { type: "json" });
			if (!found || found.etag === undefined) return null;
			return { key, etag: found.etag, record: found.data as AlertRecord };
		},
		async put(key, record, opts) {
			const result = await store.setJSON(
				key,
				record,
				opts?.onlyIfMatch === undefined
					? undefined
					: { onlyIfMatch: opts.onlyIfMatch },
			);
			return result.modified;
		},
		async delete(key) {
			await store.delete(key);
		},
		async setMeta(key, value) {
			await store.setJSON(key, value);
		},
	};
}
