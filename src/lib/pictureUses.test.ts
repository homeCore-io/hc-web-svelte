import { describe, expect, it } from 'vitest';
import { usesSaid, useName } from './pictureUses.js';
import type { Picture } from './pictures.svelte.js';

const n = {
	room: (id: string) => ({ g1: 'Garage' })[id],
	page: (id: string) => ({ p1: 'Garden' })[id],
	display: (id: string) => ({ d1: 'Hallway' })[id]
};

describe('where a picture is used, said (design 15, P4)', () => {
	it('names rooms, people, pages and displays', () => {
		expect(useName({ in: 'house', id: 'household', path: ['photos', 'g1', 'src'] }, n)).toBe(
			'Garage: its photo'
		);
		expect(useName({ in: 'person', id: 'me', path: ['photo'] }, n)).toBe('Your picture');
		expect(
			useName({ in: 'house', id: 'household', path: ['pages', 'lit|home', 3, 'config', 'src'] }, n)
		).toBe('A Picture card on Home');
		expect(
			useName({ in: 'person', id: 'me', path: ['pages', 'page:p1', 0, 'config', 'src'] }, n)
		).toBe('A Picture card on your Garden');
		expect(useName({ in: 'display', id: 'd1', path: ['rest', 'album'] }, n)).toBe(
			'Hallway: its picture frame'
		);
	});

	it('says each once, and only counts others’ own pages', () => {
		const p = {
			uses: [
				{ in: 'house', id: 'household', path: ['pages', 'home', 1, 'config', 'src'] },
				{ in: 'house', id: 'household', path: ['pages', 'home', 4, 'config', 'src'] }
			],
			elsewhere: 2
		} as unknown as Picture;
		expect(usesSaid(p, n)).toEqual(['A Picture card on Home', '2 places on others’ own pages']);
	});
});
