/**
 * Times and dates, said one way everywhere in the app (#62): the person's
 * own locale decides 12 or 24 hours, hours are never zero-padded, and a
 * year is said only when it isn't this one.
 *
 *   timeOf      "2:04 PM" (or "14:04"), with seconds for logs
 *   dateOf      "Oct 27" — "Oct 27, 2025" in another year
 *   fullDateOf  "Oct 27, 2026"
 *   momentOf    "Today, 2:04 PM" · "Yesterday, 2:04 PM" · "Oct 27, 2:04 PM"
 */

export type When = string | number | Date;

const at = (x: When): Date => (x instanceof Date ? x : new Date(x));

/** "2:04 PM" — or "14:04" where the person reads 24 hours. */
export const timeOf = (x: When, seconds = false): string =>
	at(x).toLocaleTimeString([], {
		hour: 'numeric',
		minute: '2-digit',
		...(seconds ? { second: '2-digit' } : {})
	});

/** A time of day given as minutes after midnight, in the person's clock. */
export const minutesOf = (m: number, hourOnly = false): string =>
	new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(
		[],
		hourOnly ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' }
	);

/** "Oct 27"; "Oct 27, 2025" when it isn't this year. */
export const dateOf = (x: When, now: When = Date.now()): string => {
	const d = at(x);
	return d.toLocaleDateString([], {
		day: 'numeric',
		month: 'short',
		...(d.getFullYear() !== at(now).getFullYear() ? { year: 'numeric' } : {})
	});
};

/** "Oct 27, 2026" — always with its year. */
export const fullDateOf = (x: When): string =>
	at(x).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** Days from `x`'s calendar day to `now`'s, where the person is. */
const daysBack = (x: Date, now: Date): number => {
	const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
	return day(now) - day(x);
};

/** "Today, 2:04 PM", "Yesterday, 2:04 PM", "Oct 27, 2:04 PM" — `inline`
 *  for the middle of a sentence: "since today, 2:04 PM". */
export function momentOf(x: When, now: When = Date.now(), inline = false): string {
	const d = at(x);
	const back = daysBack(d, at(now));
	const day =
		back === 0
			? inline
				? 'today'
				: 'Today'
			: back === 1
				? inline
					? 'yesterday'
					: 'Yesterday'
				: dateOf(d, now);
	return `${day}, ${timeOf(d)}`;
}

/** "5 min ago", "3 h ago", "12 d ago" — never "285 h ago". */
export function agoOf(x: When, now: When = Date.now()): string {
	const min = Math.floor((at(now).getTime() - at(x).getTime()) / 60_000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min ago`;
	const h = Math.floor(min / 60);
	return h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}
