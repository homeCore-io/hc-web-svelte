/**
 * Sizing a console tab to the window: `use:fit` sets `--k` on the tab, from
 * 1 (everything at its largest) down to 0 (its smallest), to the largest
 * that leaves the page without a scrollbar and the tab's columns in one row.
 * Where one row can't fit even at the smallest, the columns wrap and only
 * the scrollbar counts. The tab's sizes are written against it
 * (`calc(120px + 90px * var(--k))`), so dials, doors and readings shrink
 * together on a short window and grow back on a tall one.
 *
 * Measured when the window or the page changes size, and when `key` does
 * (what the tab shows). Nothing is drawn between tries: the page is laid out
 * to measure.
 */
export function fit(node: HTMLElement, key?: unknown) {
	const doc = document.documentElement;
	const scrolls = () => doc.scrollHeight > window.innerHeight + 1;
	const wraps = () => {
		const cols = [...node.children] as HTMLElement[];
		const top = cols[0]?.offsetTop ?? 0;
		return cols.some((c) => c.offsetTop > top + 4);
	};
	const at = (k: number) => node.style.setProperty('--k', String(k));
	/** The largest `--k` at which `bad` is false; 0 when there's none. */
	function largest(bad: () => boolean): number {
		at(1);
		if (!bad()) return 1;
		at(0);
		if (bad()) return -1;
		let lo = 0;
		let hi = 1;
		for (let i = 0; i < 7; i++) {
			const mid = (lo + hi) / 2;
			at(mid);
			if (bad()) hi = mid;
			else lo = mid;
		}
		return Math.floor(lo * 100) / 100;
	}
	// What the tab sits in, and its size once measured: a change from that is the page's own.
	const box = node.parentElement ?? document.body;
	let settled = '';
	const sizeOf = () => `${box.clientWidth}x${box.clientHeight}x${doc.scrollHeight}`;
	function size() {
		// Measured without the page's scrollbar, which would come and go between tries
		// and narrow the tab as it did.
		const was = doc.style.overflowY;
		doc.style.overflowY = 'hidden';
		let k = largest(() => scrolls() || wraps());
		if (k < 0) k = Math.max(0, largest(scrolls));
		at(k);
		doc.style.overflowY = was;
		settled = sizeOf();
	}
	let frame = 0;
	const soon = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(size);
	};
	// The page around the tab settles after it (the sidebar, the audio bar, a font): measure again then.
	const seen = new ResizeObserver(() => {
		if (sizeOf() !== settled) soon();
	});
	seen.observe(box);
	seen.observe(document.body);
	// Or when something comes or goes around it (the room's audio bar), which may not resize either.
	const page = box.parentElement ?? box;
	const changed = new MutationObserver(soon);
	changed.observe(page, { childList: true, subtree: true });
	soon();
	window.addEventListener('resize', soon);
	void document.fonts?.ready.then(soon);
	return {
		update(next: unknown) {
			if (next !== key) {
				key = next;
				soon();
			}
		},
		destroy() {
			cancelAnimationFrame(frame);
			seen.disconnect();
			changed.disconnect();
			window.removeEventListener('resize', soon);
		}
	};
}
