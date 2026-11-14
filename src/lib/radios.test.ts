import { describe, expect, it } from 'vitest';
import { radioStep, radioTab } from './radios.js';

describe('a radio group’s keys', () => {
	it('moves forward and back with the arrows, wrapping round', () => {
		expect(radioStep('ArrowRight', 0, 3)).toBe(1);
		expect(radioStep('ArrowDown', 2, 3)).toBe(0);
		expect(radioStep('ArrowLeft', 0, 3)).toBe(2);
		expect(radioStep('ArrowUp', 1, 3)).toBe(0);
	});

	it('goes to the first or last with Home and End, and ignores other keys', () => {
		expect(radioStep('Home', 2, 3)).toBe(0);
		expect(radioStep('End', 0, 3)).toBe(2);
		expect(radioStep('Enter', 1, 3)).toBeUndefined();
		expect(radioStep('ArrowRight', 0, 0)).toBeUndefined();
	});

	it('makes only the chosen one a tab stop, else the first', () => {
		expect(radioTab(true, false, true)).toBe(0);
		expect(radioTab(false, true, true)).toBe(-1);
		expect(radioTab(false, true, false)).toBe(0);
		expect(radioTab(false, false, false)).toBe(-1);
	});
});
