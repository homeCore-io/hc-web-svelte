import { describe, expect, it } from 'vitest';
import { changesFrom } from './diff.js';
import { BUILT_IN, CONSOLE, LIT, copyOf } from './model.js';

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
			expect.stringMatching(/^What starts where in a room: Header, Needs you, Doors/)
		]);
	});
});

describe('the new drawings in what changed (13 §13.1)', () => {
	it('names a chip, a row and a band', () => {
		const l = copyOf(LIT, 'Calm', BUILT_IN);
		l.drawings = { ...l.drawings, lights: 'chip', switches: 'row', readings: 'band' };
		expect(changesFrom(l, LIT)).toEqual([
			'Lights drawn as chips',
			'Switches drawn as rows',
			'Readings drawn with their usual range'
		]);
	});
});

describe('the frame in what changed', () => {
	it('names the console frame, and the standard one when a look leaves it', () => {
		const desk = copyOf(LIT, 'Desk', BUILT_IN);
		desk.frame = { ...desk.frame, shell: 'console' };
		expect(changesFrom(desk, LIT)).toEqual(['Frame: the console']);
		const plain = copyOf(CONSOLE, 'Plain', BUILT_IN);
		plain.frame = { ...plain.frame, shell: 'standard' };
		expect(changesFrom(plain, CONSOLE)).toEqual(['Frame: the standard sidebar']);
	});
});
