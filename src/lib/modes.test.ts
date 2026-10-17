import { describe, expect, it } from 'vitest';
import {
	checksOf,
	conditionOf,
	criteriaOf,
	criteriaProblems,
	draftOf,
	howOf,
	minutes,
	modeIdFor,
	offsetText,
	spans,
	type CoreMode
} from './modes.js';

const night: CoreMode = {
	config: {
		id: 'mode_night',
		name: 'Night Mode',
		kind: 'solar',
		on_event: 'Sunset',
		off_event: 'Sunrise'
	},
	state: null,
	definition: null
};

it('says how a mode decides', () => {
	expect(howOf(night)).toBe('Sunset to sunrise');
	expect(howOf({ ...night, config: { ...night.config, on_offset_minutes: -30 } })).toBe(
		'Sunset −30 min to sunrise'
	);
	expect(howOf({ ...night, config: { id: 'mode_g', name: 'Guests', kind: 'manual' } })).toBe(
		'On or off by hand and by rules'
	);
	expect(
		howOf({
			...night,
			config: { id: 'mode_a', name: 'Away', kind: 'manual' },
			definition: {
				mode_id: 'mode_a',
				criteria: { on_condition: {}, off_behavior: 'inverse', reevaluate_every_n_minutes: 1 },
				generated_rule_ids: []
			}
		})
	).toBe('On while a condition holds');
	expect(howOf({ ...night, config: { id: 'x', name: 'x', kind: 'solar' } })).toMatch(/no times/);
});

it('draws a night as two spans of the day', () => {
	expect(spans(minutes('18:27')!, minutes('07:18')!)).toEqual([
		{ from: 0, to: 438 },
		{ from: 1107, to: 1440 }
	]);
	expect(spans(438, 1107)).toEqual([{ from: 438, to: 1107 }]);
	expect(minutes('7:05')).toBe(425);
	expect(minutes(null)).toBeNull();
	expect(offsetText(15)).toBe('+15 min');
	expect(modeIdFor('Movie night')).toBe('mode_movie_night');
});

describe('a mode that switches itself', () => {
	const away = { DeviceState: { device_id: 'phone_j', attribute: 'home', op: 'Eq', value: false } };
	const dark = { ModeIs: { mode_id: 'mode_night', on: true } };

	it('reads one condition or "all of" as a list of checks, and back', () => {
		expect(checksOf(away)).toEqual([away]);
		expect(checksOf({ And: { conditions: [away, dark] } })).toEqual([away, dark]);
		expect(checksOf(null)).toEqual([]);
		expect(conditionOf([away])).toEqual(away);
		expect(conditionOf([away, dark])).toEqual({ And: { conditions: [away, dark] } });
	});

	it('round-trips homeCore’s definition', () => {
		const d = draftOf({
			mode_id: 'mode_away',
			criteria: {
				on_condition: { And: { conditions: [away, dark] } },
				off_behavior: 'explicit',
				off_condition: dark,
				reevaluate_every_n_minutes: 5
			},
			generated_rule_ids: []
		});
		expect(d).toEqual({ on: [away, dark], explicit: true, off: [dark], every: 5 });
		expect(criteriaOf(d)).toEqual({
			on_condition: { And: { conditions: [away, dark] } },
			off_behavior: 'explicit',
			off_condition: dark,
			reevaluate_every_n_minutes: 5
		});
		expect(criteriaOf({ ...d, explicit: false })).not.toHaveProperty('off_condition');
	});

	it('says what stops it saving', () => {
		const ok = { on: [away], explicit: false, off: [], every: 1 };
		expect(criteriaProblems('mode_away', ok)).toEqual([]);
		expect(criteriaProblems('mode_away', { ...ok, on: [] })).toContain('Say when it turns on.');
		expect(criteriaProblems('mode_away', { ...ok, explicit: true })).toContain(
			'Say when it turns off.'
		);
		expect(criteriaProblems('mode_night', { ...ok, on: [dark] })).toContain(
			'It can’t depend on itself.'
		);
		expect(
			criteriaProblems('mode_away', {
				...ok,
				on: [{ DeviceState: { device_id: '', attribute: 'on', op: 'Eq', value: true } }]
			})
		).toContain('Choose a device for each check.');
	});
});
