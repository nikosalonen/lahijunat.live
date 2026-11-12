/** @format */

import { tf } from "../utils/translations";

/** A line letter linking to the line's page, styled like the train cards' badge. */
export default function LineBadge({ line }: { line: string }) {
	return (
		<a
			href={`/linja/${line.toLowerCase()}/`}
			aria-label={tf("lineHeading", { line })}
			class="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-primary text-primary-content text-xs font-bold hover:opacity-80 transition-opacity"
		>
			{line}
		</a>
	);
}
