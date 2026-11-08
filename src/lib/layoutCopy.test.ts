import { describe, expect, it } from 'vitest';
import { layoutOf, withLayout, withoutPlaces } from './layoutCopy.js';
import type { Change } from './layers.js';

const garage: Change[] = [
	{ op: 'place', ref: 'section:doors', x: 0, y: 2, w: 8, h: 1 },
	{ op: 'rename', ref: 'section:doors', name: 'Ways in' },
	{ op: 'place', ref: 'device:garage_door', x: 0, y: 3, w: 4, h: 3 },
	{ op: 'hide', ref: 'device:attic' },
	{ op: 'hide', ref: 'heading:readings' },
	{ op: 'add', ref: 'kind:title/a1', into: 'doors' },
	{ op: 'config', ref: 'kind:title/a1', config: { text: 'Garage' } },
	{ op: 'place', ref: 'kind:title/a1', x: 0, y: 0, w: 12, h: 2 },
	{ op: 'place', ref: 'kind:stack/rule-switches', x: 8, y: 2, w: 4, h: 6 },
	{ op: 'config', ref: 'kind:stack/rule-switches', config: { things: ['device:heater'] } }
];

describe('a room’s layout, carried (14 §8, L3)', () => {
	it('takes headings, widgets and the look’s stacks, not the room’s own devices', () => {
		const refs = layoutOf(garage).map((c) => `${c.op} ${c.ref}`);
		expect(refs).toContain('place section:doors');
		expect(refs).toContain('rename section:doors');
		expect(refs).toContain('add kind:title/a1');
		expect(refs).toContain('place kind:stack/rule-switches');
		expect(refs).toContain('hide heading:readings');
		// Another room's stack holds its own things; its devices aren't these.
		expect(refs).not.toContain('config kind:stack/rule-switches');
		expect(refs.some((r) => r.includes('device:'))).toBe(false);
	});

	it('lets the room’s devices fill in under the headings, and keeps its own choices', () => {
		const office: Change[] = [
			{ op: 'place', ref: 'device:office_tv', x: 4, y: 9, w: 6, h: 3 },
			{ op: 'hide', ref: 'device:office_fan' },
			{ op: 'rename', ref: 'section:doors', name: 'Doors' }
		];
		const out = withLayout(office, layoutOf(garage));
		expect(out.some((c) => c.op === 'place' && c.ref === 'device:office_tv')).toBe(false);
		expect(out).toContainEqual({ op: 'hide', ref: 'device:office_fan' });
		expect(out).toContainEqual({ op: 'rename', ref: 'section:doors', name: 'Ways in' });
		expect(out.filter((c) => c.ref === 'section:doors' && c.op === 'rename')).toHaveLength(1);
	});

	it('goes back to the look’s layout by taking places away and nothing else', () => {
		const out = withoutPlaces(garage);
		expect(out.filter((c) => c.ref.length > 0).map((c) => c.op)).not.toContain('place');
		expect(out).toContainEqual({ op: 'hide', ref: 'device:attic' });
	});
});

describe('a stack someone made, carried', () => {
	it('goes empty: what it held is the other room’s', () => {
		const out = layoutOf([
			{ op: 'add', ref: 'kind:stack/s1', into: 'controls' },
			{
				op: 'config',
				ref: 'kind:stack/s1',
				config: { name: 'Switches', things: ['device:heater'] }
			}
		]);
		expect(out).toContainEqual({
			op: 'config',
			ref: 'kind:stack/s1',
			config: { name: 'Switches', things: [] }
		});
	});
});
