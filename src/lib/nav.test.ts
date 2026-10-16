import { describe, expect, it } from 'vitest';
import { isAt, titleFor } from './nav.js';
import { humanise } from './text.js';

describe('where the app is', () => {
	it('marks Home only at the root, and other places at or under themselves', () => {
		expect(isAt('/', '/')).toBe(true);
		expect(isAt('/pages', '/')).toBe(false);
		expect(isAt('/pages/x', '/pages')).toBe(true);
		expect(isAt('/pagesmith', '/pages')).toBe(false);
	});
	it('titles a page it knows, and falls back for one it does not', () => {
		expect(titleFor('/scenes')).toBe('Scenes');
		expect(titleFor('/rooms/abc')).toBe('homeCore');
	});
});

describe('a slug read as words', () => {
	it('reads living_room as Living room', () => {
		expect(humanise('living_room')).toBe('Living room');
		expect(humanise('')).toBe('');
	});
});
