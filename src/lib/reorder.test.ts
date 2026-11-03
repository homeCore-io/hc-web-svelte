import { describe, expect, it } from 'vitest';
import { moved } from './reorder.js';

describe('moving a row in a list (13 §11)', () => {
	it('takes it out and puts it where it was dropped', () => {
		expect(moved(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
		expect(moved(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a']);
		expect(moved(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
	});
});
