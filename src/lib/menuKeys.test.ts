import { describe, expect, it } from 'vitest';
import { nextItem, nextTab } from './menuKeys.js';

describe('arrow keys in a menu', () => {
	it('moves down and up, wrapping round', () => {
		expect(nextItem('ArrowDown', 0, 3)).toBe(1);
		expect(nextItem('ArrowDown', 2, 3)).toBe(0);
		expect(nextItem('ArrowUp', 0, 3)).toBe(2);
		expect(nextItem('ArrowUp', 2, 3)).toBe(1);
	});
	it('starts at the first or last item when none has focus', () => {
		expect(nextItem('ArrowDown', -1, 3)).toBe(0);
		expect(nextItem('ArrowUp', -1, 3)).toBe(2);
	});
	it('goes to the ends with Home and End', () => {
		expect(nextItem('Home', 2, 3)).toBe(0);
		expect(nextItem('End', 0, 3)).toBe(2);
	});
	it('leaves other keys, and an empty menu, alone', () => {
		expect(nextItem('Tab', 0, 3)).toBeNull();
		expect(nextItem('ArrowDown', -1, 0)).toBeNull();
	});
});

describe('keys in a row of tabs', () => {
	it('moves left and right, wrapping round, and jumps to the ends', () => {
		expect(nextTab('ArrowRight', 2, 3)).toBe(0);
		expect(nextTab('ArrowLeft', 0, 3)).toBe(2);
		expect(nextTab('Home', 2, 3)).toBe(0);
		expect(nextTab('End', 0, 3)).toBe(2);
	});
	it('does nothing for other keys or when no tab is shown', () => {
		expect(nextTab('ArrowDown', 1, 3)).toBeNull();
		expect(nextTab('End', -1, 3)).toBeNull();
	});
});
