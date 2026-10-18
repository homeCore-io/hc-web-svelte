/**
 * Read a page again when someone comes back to it — another tab, the phone
 * woken — for the settings homeCore doesn't announce changes to (people,
 * keys, displays, alert rules, the settings file…). Returns the way to stop,
 * for `onMount` to hand back.
 */
export function onReturn(reload: () => unknown): () => void {
	const back = () => {
		if (document.visibilityState === 'visible') void reload();
	};
	document.addEventListener('visibilitychange', back);
	return () => document.removeEventListener('visibilitychange', back);
}
