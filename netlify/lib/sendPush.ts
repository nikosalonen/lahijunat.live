import webpush from "web-push";
import { siteUrl } from "./config";
import type { AlertLang, AlertPush, AlertRecord } from "./types";
import { isAllowedPushEndpoint } from "./validate";

/** Declarative Web Push: the browser shows the notification without running a service worker. */
export interface DeclarativePushPayload {
	web_push: 8030;
	notification: {
		title: string;
		body: string;
		navigate: string;
		lang: AlertLang;
		tag: string;
	};
}

export function buildPushPayload(push: AlertPush): DeclarativePushPayload {
	return {
		web_push: 8030,
		notification: {
			title: push.title,
			body: push.body,
			navigate: push.url,
			lang: push.lang,
			tag: push.tag,
		},
	};
}

/**
 * sent: delivered to the push service.
 * gone: the subscription no longer exists, so the record can be deleted.
 * dropped: the payload was too large. Never retried.
 * failed: anything else. The job may try again on a later run.
 */
export type SendResult = "sent" | "gone" | "dropped" | "failed";

export async function sendAlertPush(
	record: AlertRecord,
	push: AlertPush,
	env: NodeJS.ProcessEnv = process.env,
): Promise<SendResult> {
	// Stored data is not trusted: never post to a host outside the allowlist.
	if (!isAllowedPushEndpoint(record.endpoint)) {
		console.warn("push endpoint not allowed", { tag: push.tag });
		return "gone";
	}
	const publicKey = env.PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) {
		// "failed" keeps the record and retries; its own log line names the cause.
		console.warn("push send skipped: VAPID keys missing", { tag: push.tag });
		return "failed";
	}
	try {
		await webpush.sendNotification(
			{ endpoint: record.endpoint, keys: record.keys },
			JSON.stringify(buildPushPayload(push)),
			{
				TTL: push.ttlSeconds,
				urgency: "high",
				// web-push has no default timeout, and the job must finish inside 30 s.
				timeout: 10_000,
				vapidDetails: { subject: siteUrl(env), publicKey, privateKey },
			},
		);
		return "sent";
	} catch (error) {
		const statusCode = (error as { statusCode?: number }).statusCode;
		// Log only the status and tag: the endpoint, keys and text are private.
		console.warn("push send failed", { statusCode, tag: push.tag });
		if (statusCode === 404 || statusCode === 410) return "gone";
		if (statusCode === 413) return "dropped";
		return "failed";
	}
}
