import { expect, it } from 'vitest';
import {
	asSettings,
	asSteps,
	describeState,
	othersIn,
	sceneable,
	settingsOf,
	shownSettings,
	stateNow
} from './sceneEdit.js';
import type { CoreDevice } from './devices.js';

const dimmer: CoreDevice = {
	device_id: 'lutron_overhead',
	name: 'Overhead',
	available: true,
	device_type: 'light',
	attributes: { on: true, brightness_pct: 75, brightness: 191 },
	schema: {
		attributes: {
			on: { kind: 'bool', writable: true, display_name: 'Power' },
			brightness_pct: {
				kind: 'integer',
				writable: true,
				min: 0,
				max: 100,
				step: 1,
				unit: '%',
				display_name: 'Brightness'
			},
			brightness: { kind: 'integer' }
		},
		primary: ['on', 'brightness_pct']
	}
};
const sensor: CoreDevice = {
	device_id: 's',
	name: 'S',
	available: true,
	attributes: { temperature: 20 },
	schema: { attributes: { temperature: { kind: 'float' } } }
};

it('a scene sets what a device says is writable', () => {
	expect(settingsOf(dimmer).map((s) => s.attr)).toEqual(['on', 'brightness_pct']);
	expect(sceneable(dimmer)).toBe(true);
	expect(sceneable(sensor)).toBe(false);
});

it('takes how it is now, and off is just off', () => {
	expect(stateNow(dimmer)).toEqual({ on: true, brightness_pct: 75 });
	expect(stateNow({ ...dimmer, attributes: { on: false, brightness_pct: 40 } })).toEqual({
		on: false
	});
});

it('says a state in words', () => {
	const s = settingsOf(dimmer);
	expect(describeState({ on: true, brightness_pct: 30 }, s)).toBe('on · 30 %');
	expect(describeState({ on: false }, s)).toBe('off');
	expect(describeState({ actions: [{ on: true }] }, s)).toBe('one step');
	expect(describeState({ actions: [{ on: true }, { action: 'x' }] }, s)).toBe('2 steps, in order');
});

const speaker: CoreDevice = {
	device_id: 'sonos_den',
	name: 'Den',
	available: true,
	attributes: { volume: 20, bass: 0, treble: 0, loudness: true, mute: false },
	schema: {
		attributes: Object.fromEntries(
			['volume', 'bass', 'treble'].map((a) => [
				a,
				{
					kind: 'integer',
					writable: true,
					min: a === 'volume' ? 0 : -10,
					max: a === 'volume' ? 100 : 10
				}
			])
		) as never,
		primary: ['volume']
	}
};
speaker.schema!.attributes!.loudness = { kind: 'bool', writable: true };
speaker.schema!.attributes!.mute = { kind: 'bool', writable: true };

it('every setting is there to show, the first few at once and any it sets', () => {
	const all = settingsOf(speaker, Infinity);
	expect(all.map((s) => s.attr)).toEqual(['volume', 'bass', 'treble', 'loudness', 'mute']);
	expect(settingsOf(speaker).length).toBe(3);
	expect(shownSettings(all, { mute: true }, false).map((s) => s.attr)).toEqual([
		'volume',
		'bass',
		'treble',
		'mute'
	]);
	expect(shownSettings(all, {}, true)).toHaveLength(5);
	// A new entry takes only the first few, as it is now.
	expect(stateNow(speaker)).toEqual({ volume: 20, bass: 0, treble: 0 });
});

it('what the form has no control for is kept and named', () => {
	const all = settingsOf(speaker, Infinity);
	expect(othersIn({ volume: 5, favorite: 'Jazz' }, all)).toEqual([['favorite', 'Jazz']]);
	expect(othersIn({ actions: [] }, all)).toEqual([]);
});

it('an entry turns into steps and back', () => {
	expect(asSteps({ brightness_pct: 30, on: true })).toEqual({
		actions: [{ on: true }, { brightness_pct: 30 }]
	});
	expect(asSteps({})).toEqual({ actions: [] });
	expect(asSettings({ actions: [{ on: false }] }, dimmer)).toEqual({ on: false });
	// Steps that aren't one plain state go back to how it is now.
	expect(asSettings({ actions: [{ on: true }, { brightness_pct: 10 }] }, dimmer)).toEqual({
		on: true,
		brightness_pct: 75
	});
	expect(asSettings({ actions: [{ action: 'play_favorite' }] }, dimmer)).toEqual({
		on: true,
		brightness_pct: 75
	});
});
