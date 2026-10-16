/**
 * A slug as words: `living_room` → "Living room".
 *
 * A homeCore from before H1 keeps only a room's slug; this is the best
 * reading of it. Can go once every homeCore the app talks to has H1.
 */
export function humanise(slug: string): string {
	const words = slug.replace(/[_-]+/g, ' ').trim();
	return words === '' ? words : words[0]!.toUpperCase() + words.slice(1);
}
