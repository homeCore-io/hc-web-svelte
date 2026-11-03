import { describe, expect, it } from 'vitest';
import { changesFrom } from './diff.js';
import { BUILT_IN, LIT, copyOf } from './model.js';

describe('what changed from the look it was made from (13 §11)', () => {
	it('is nothing for a fresh copy', () => {
		expect(changesFrom(copyOf(LIT, 'Evening', BUILT_IN), LIT)).toEqual([]);
	});

	it('names each choice that differs, in the editor’s words', () => {
		const l = copyOf(LIT, 'Evening', BUILT_IN);
		l.theme = 'plum';
		l.feel = { ...l.feel, motion: 'gentle' };
		l.drawings = { ...l.drawings, lights: 'classic' };
		l.frame = { ...l.frame, header: 'plain' };
		l.grouping = { room: l.grouping.room!.filter((r) => r.id !== 'scenes') };
		expect(changesFrom(l, LIT)).toEqual([
			'Theme: plum',
			'Motion: gentle',
			'Lights drawn the Classic way',
			'Header: plain',
			expect.stringMatching(/^A room’s sections: Header, Needs you, Doors/)
		]);
	});
});
