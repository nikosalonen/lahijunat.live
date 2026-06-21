/** @format */

import { useEffect, useRef, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import { hapticLight } from "../utils/haptics";
import { showToast } from "../utils/toast";
import { t } from "../utils/translations";

type ShareTarget = "homepage" | "current";

/** The homepage (base) URL. */
function getBaseUrl(): string {
	return typeof window !== "undefined" ? `${window.location.origin}/` : "";
}

/** The full URL of the page the user is currently viewing. */
function getCurrentUrl(): string {
	return typeof window !== "undefined" ? window.location.href : "";
}

/** Whether the current page is a specific route worth sharing (not the homepage). */
function isOnRoute(): boolean {
	return typeof window !== "undefined" && window.location.pathname !== "/";
}

function canNativeShare(): boolean {
	return (
		typeof navigator !== "undefined" && typeof navigator.share === "function"
	);
}

export default function ShareButton() {
	const [isOpen, setIsOpen] = useState(false);
	const [qrSvg, setQrSvg] = useState<string | null>(null);
	const [qrFailed, setQrFailed] = useState(false);
	// Default to the current view when viewing a route, otherwise the homepage.
	const [target, setTarget] = useState<ShareTarget>(() =>
		isOnRoute() ? "current" : "homepage",
	);
	const dialogRef = useRef<HTMLDivElement>(null);
	useLanguageChange();

	const hasRoute = isOnRoute();
	const shareUrl = target === "current" ? getCurrentUrl() : getBaseUrl();

	// Generate the QR code whenever the modal opens or the chosen target
	// changes. The library is lazy-loaded so it stays out of the initial bundle.
	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		setQrSvg(null);
		setQrFailed(false);
		(async () => {
			try {
				const qrcode = (await import("qrcode-generator")).default;
				const qr = qrcode(0, "M");
				qr.addData(shareUrl);
				qr.make();
				const svg = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
				if (!cancelled) setQrSvg(svg);
			} catch {
				if (!cancelled) setQrFailed(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [isOpen, shareUrl]);

	// Move focus into the dialog when it opens.
	useEffect(() => {
		if (isOpen) dialogRef.current?.focus();
	}, [isOpen]);

	const open = () => {
		hapticLight();
		setIsOpen(true);
	};

	const close = () => setIsOpen(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			hapticLight();
			showToast(t("linkCopied"), "success");
		} catch {
			showToast(t("copyLinkFailed"), "error");
		}
	};

	const handleNativeShare = async () => {
		try {
			await navigator.share({
				title: t("shareModalTitle"),
				text: t("shareModalDescription"),
				url: shareUrl,
			});
		} catch (error) {
			// The user dismissing the share sheet is not an error.
			if ((error as Error)?.name !== "AbortError") {
				showToast(t("shareFailed"), "error");
			}
		}
	};

	return (
		<>
			<button
				type="button"
				onClick={open}
				aria-label={t("shareButtonLabel")}
				aria-haspopup="dialog"
				className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:bg-white/20 cursor-pointer transition-colors"
			>
				<svg
					className="w-5 h-5 sm:w-6 sm:h-6"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="18" cy="5" r="3" />
					<circle cx="6" cy="12" r="3" />
					<circle cx="18" cy="19" r="3" />
					<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
					<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
				</svg>
			</button>

			{isOpen && (
				<div
					className="modal modal-open"
					role="dialog"
					aria-modal="true"
					aria-labelledby="share-modal-title"
					ref={dialogRef}
					tabIndex={-1}
					onKeyDown={(event) => {
						if (event.key === "Escape") close();
					}}
					onClick={(event) => {
						// Close when clicking the dimmed backdrop, not the dialog box.
						if (event.target === event.currentTarget) close();
					}}
				>
					<div className="modal-box max-w-sm text-center">
						<h3 id="share-modal-title" className="font-bold text-lg mb-1">
							{t("shareModalTitle")}
						</h3>
						<p className="text-sm text-base-content/70 mb-4">
							{t("shareModalDescription")}
						</p>

						{hasRoute && (
							<fieldset className="join mb-4">
								<legend className="sr-only">{t("shareTargetLabel")}</legend>
								<button
									type="button"
									className={`btn btn-sm join-item ${target === "current" ? "btn-active" : ""}`}
									aria-pressed={target === "current"}
									onClick={() => setTarget("current")}
								>
									{t("shareCurrentView")}
								</button>
								<button
									type="button"
									className={`btn btn-sm join-item ${target === "homepage" ? "btn-active" : ""}`}
									aria-pressed={target === "homepage"}
									onClick={() => setTarget("homepage")}
								>
									{t("shareHomepage")}
								</button>
							</fieldset>
						)}

						<div className="flex justify-center mb-4">
							{qrSvg ? (
								<div
									className="bg-white p-3 rounded-xl w-48 h-48 [&>svg]:w-full [&>svg]:h-full"
									role="img"
									aria-label={t("qrCodeAlt")}
									dangerouslySetInnerHTML={{ __html: qrSvg }}
								/>
							) : qrFailed ? (
								<div className="w-48 h-48 flex items-center justify-center bg-base-200 rounded-xl text-sm text-base-content/60 p-3">
									{t("qrCodeAlt")}
								</div>
							) : (
								<div className="skeleton w-48 h-48 rounded-xl" />
							)}
						</div>

						<p className="font-mono text-xs break-all text-base-content/80 mb-4 select-all">
							{shareUrl}
						</p>

						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={handleCopy}
								className="btn btn-primary"
							>
								{t("copyLink")}
							</button>
							{canNativeShare() && (
								<button
									type="button"
									onClick={handleNativeShare}
									className="btn btn-ghost"
								>
									{t("nativeShare")}
								</button>
							)}
							<button type="button" onClick={close} className="btn btn-ghost">
								{t("closeShareModal")}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
