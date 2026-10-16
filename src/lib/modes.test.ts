import { expect, it } from 'vitest';
import { howOf, minutes, modeIdFor, offsetText, spans, type CoreMode } from './modes.js';

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
		howOf({ ...night, config: { id: 'mode_a', name: 'Away', kind: 'manual' }, definition: {} })
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
