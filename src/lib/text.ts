/**
 * A slug as words: `living_room` → "Living room".
 *
 * Until homeCore keeps the name a room was given (H1), its slug is all there
 * is; this is the best reading of it, and goes away when H1 lands.
 */
export function humanise(slug: string): string {
	const words = slug.replace(/[_-]+/g, ' ').trim();
	return words === '' ? words : words[0]!.toUpperCase() + words.slice(1);
}
