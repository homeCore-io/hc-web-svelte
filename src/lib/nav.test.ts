import { describe, expect, it } from 'vitest';
import { docTitle, isAt, titleFor } from './nav.js';
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
	it('names the browser tab after the page, then its address, then the app', () => {
		expect(docTitle('/rooms/abc', 'Office')).toBe('Office · homeCore');
		expect(docTitle('/settings/devices')).toBe('Devices · homeCore');
		expect(docTitle('/everywhere/lights')).toBe('Lights · Everywhere · homeCore');
		expect(docTitle('/everywhere/nope')).toBe('Everywhere · homeCore');
		expect(docTitle('/')).toBe('Home · homeCore');
		expect(docTitle('/rooms')).toBe('Rooms · homeCore');
		expect(docTitle('/rooms/abc', '  ')).toBe('homeCore');
		expect(docTitle('/somewhere')).toBe('homeCore');
	});
});

describe('a slug read as words', () => {
	it('reads living_room as Living room', () => {
		expect(humanise('living_room')).toBe('Living room');
		expect(humanise('')).toBe('');
	});
});
