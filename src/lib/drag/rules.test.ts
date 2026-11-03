import { describe, expect, it } from 'vitest';
import { beforeAt, refusal, type Spot } from './rules.js';

const lights = { id: 'lights', title: 'Lights', accepts: true };

describe('which sections take a dragged card (13 §9.4)', () => {
	it('takes a card into a section that accepts cards', () => {
		expect(refusal(lights, 'device', 'switches')).toBeNull();
		expect(refusal(lights, 'device', '')).toBeNull();
	});

	it('refuses Favorites, fixed and bare sections, with the reason', () => {
		expect(refusal({ id: 'favourites', title: 'Favorites', favourites: true }, 'device', '')).toBe(
			'Favorites holds only starred things'
		);
		expect(refusal({ id: 'head', title: 'Header', fixed: true }, 'device', 'lights')).toBe(
			'Header keeps its own'
		);
	});

	it('keeps rooms among the rooms, and other cards out of them', () => {
		const rooms = { id: 'rooms', title: 'Rooms', accepts: true };
		expect(refusal(rooms, 'room', 'rooms')).toBeNull();
		expect(refusal(lights, 'room', 'rooms')).toBe('A room stays among the rooms');
		expect(refusal(rooms, 'device', 'pinned')).toBe('Rooms holds only rooms');
	});

	it('lets a section that takes no others reorder its own', () => {
		const head = { id: 'needs', title: 'Needs you' };
		expect(refusal(head, 'needs', 'needs')).toBeNull();
		expect(refusal(head, 'device', 'lights')).toBe('Needs you takes only its own');
		expect(refusal(undefined, 'device', 'lights')).toBe('Not here');
	});
});

describe('where in a section a dragged card lands', () => {
	// Two rows of two: a b / c d, each 100 wide and 50 high.
	const at = (ref: string, row: number, col: number): Spot => ({
		ref,
		top: row * 60,
		bottom: row * 60 + 50,
		left: col * 110,
		width: 100
	});
	const grid = [at('a', 0, 0), at('b', 0, 1), at('c', 1, 0), at('d', 1, 1)];

	it('goes in front of the card whose left half it is over', () => {
		expect(beforeAt(grid, 20, 25)).toBe('a');
		expect(beforeAt(grid, 130, 25)).toBe('b');
		expect(beforeAt(grid, 80, 85)).toBe('d');
	});

	it('goes in front of the next row when above it', () => {
		expect(beforeAt(grid, 300, 55)).toBe('c');
	});

	it('goes to the end past the last card, or in an empty section', () => {
		expect(beforeAt(grid, 200, 85)).toBeNull();
		expect(beforeAt(grid, 0, 500)).toBeNull();
		expect(beforeAt([], 0, 0)).toBeNull();
	});
});
