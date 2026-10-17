import { expect, test } from 'vitest';
import { same } from './ruleDraft.js';

test('the same rule, whatever order its fields came in', () => {
	expect(
		same({ a: 1, b: { c: [1, { d: 2, e: 3 }] } }, { b: { c: [1, { e: 3, d: 2 }] }, a: 1 })
	).toBe(true);
	expect(same({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
	expect(same({ a: 1 }, { a: 1, b: undefined })).toBe(true);
});
