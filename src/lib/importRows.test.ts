import { describe, expect, it } from 'vitest';
import { mergeRows } from './importRows.js';

describe('rows from an import', () => {
	const have = [
		{ integration_id: 6, name: 'Pico', kind: 'pico', area: 'living_room', buttons: [] },
		{ integration_id: 2, name: 'Holiday Lights 1', kind: 'switch', area: 'living_room' }
	];

	it('fills what a row lacks and keeps what someone set', () => {
		const out = mergeRows(
			have,
			[
				{
					integration_id: 6,
					name: 'Pico',
					kind: 'pico',
					area: 'Living Room',
					buttons: [2, 3, 4, 5, 6]
				},
				{ integration_id: 2, name: 'Holiday Lights 1', area: 'Living Room' }
			],
			'integration_id'
		);
		expect(out.added).toBe(0);
		expect(out.updated).toBe(1);
		expect(out.rows[0]).toEqual({
			integration_id: 6,
			name: 'Pico',
			kind: 'pico',
			area: 'living_room',
			buttons: [2, 3, 4, 5, 6]
		});
		expect(out.rows[1]).toEqual(have[1]);
	});

	it('adds rows it has not seen, and does not touch the rows it was given', () => {
		const out = mergeRows(have, [{ integration_id: 9, name: 'Remote' }], 'integration_id');
		expect(out.added).toBe(1);
		expect(out.rows).toHaveLength(3);
		expect(have[0]!.buttons).toEqual([]);
	});

	it('adds everything when the table has no key', () => {
		expect(mergeRows(have, [{ name: 'x' }], undefined).added).toBe(1);
	});
});
