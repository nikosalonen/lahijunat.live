/** @format */

import { tf } from "../utils/translations";

interface Props {
	line: string;
	/**
	 * Stretch the tap area to a 44 px row. Only for a single row of badges:
	 * in a list that wraps, the tall areas of two rows would overlap.
	 */
	tall?: boolean;
}

/**
 * A line letter linking to the line's page, styled like the train cards' badge.
 *
 * The badge is 24 px, too small to tap reliably, so an invisible `after`
 * layer grows the tap area by 4 px on each side. Lists of badges need a gap
 * of at least 8 px (`gap-2`) to keep those areas apart.
 */
export default function LineBadge({ line, tall = false }: Props) {
	const tapArea = tall
		? "after:-inset-x-1 after:-inset-y-2.5"
		: "after:-inset-1";
	return (
		<a
			href={`/linja/${line.toLowerCase()}/`}
			aria-label={tf("lineHeading", { line })}
			class={`relative after:absolute ${tapArea} inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-primary text-primary-content text-xs font-bold hover:opacity-80 transition-opacity`}
		>
			{line}
		</a>
	);
}
