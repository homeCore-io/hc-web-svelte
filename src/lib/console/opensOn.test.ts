import { afterEach, describe, expect, it, vi } from 'vitest';

// This browser's storage and how the app was opened, as stand-ins.
function browser(path: string | undefined, kept: Record<string, string> = {}) {
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => kept[k] ?? null,
		setItem: (k: string, v: string) => void (kept[k] = v),
		removeItem: (k: string) => void delete kept[k]
	});
	vi.spyOn(performance, 'getEntriesByType').mockReturnValue(
		(path === undefined ? [] : [{ name: `http://panel.local${path}` }]) as PerformanceEntryList
	);
	return kept;
}
// Each test opens the app afresh: the room is asked for once per opening.
const fresh = async () => {
	vi.resetModules();
	return import('./opensOn.js');
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('the room a screen opens on', () => {
	it('is kept in this browser, and cleared for Home', async () => {
		const kept = browser('/');
		const { opensOn, setOpensOn } = await fresh();
		expect(opensOn()).toBeUndefined();
		setOpensOn('kitchen');
		expect(opensOn()).toBe('kitchen');
		setOpensOn(undefined);
		expect(opensOn()).toBeUndefined();
		expect(kept).toEqual({});
	});

	it('is opened on once, and only when the app was opened at Home', async () => {
		browser('/', { 'hc-console-opens-on': 'kitchen' });
		let m = await fresh();
		expect(m.openingRoom()).toBe('kitchen');
		// "Whole home" afterwards shows Home.
		expect(m.openingRoom()).toBeUndefined();

		browser('/rooms/office', { 'hc-console-opens-on': 'kitchen' });
		m = await fresh();
		expect(m.openingRoom()).toBeUndefined();

		browser(undefined, { 'hc-console-opens-on': 'kitchen' });
		m = await fresh();
		expect(m.openingRoom()).toBeUndefined();
	});

	it('is Home when this browser keeps nothing', async () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		});
		const { opensOn, setOpensOn } = await fresh();
		expect(() => setOpensOn('kitchen')).not.toThrow();
		expect(opensOn()).toBeUndefined();
	});
});
