import { describe, expect, it } from 'vitest';
import type { CoreDevice } from './devices.js';
import {
	advanceWords,
	tidyWhen,
	whenWords,
	choiceName,
	choiceSources,
	commandFor,
	isChoice,
	rotatable,
	summary
} from './rotations.js';

const sonos = {
	device_id: 'sonos_bathroom',
	name: 'Bathroom',
	plugin_id: 'plugin.sonos',
	available: true,
	attributes: {
		available_favorites: ['ALT Radio', 'Piano for Sleeping'],
		available_playlists: ['Chill']
	},
	schema: {
		attributes: {},
		actions: [
			{
				id: 'play_favorite',
				label: 'Play a favourite',
				params: [
					{
						name: 'favorite',
						kind: 'enum',
						required: true,
						options_from: { attribute: { attribute: 'available_favorites' } }
					},
					{ name: 'volume', kind: 'int' }
				]
			},
			{
				id: 'play_playlist',
				label: 'Play a playlist',
				params: [
					{
						name: 'playlist',
						kind: 'enum',
						required: true,
						options_from: { attribute: { attribute: 'available_playlists' } }
					}
				]
			},
			{ id: 'next', label: 'Next track' },
			{
				id: 'set_repeat',
				label: 'Repeat',
				params: [{ name: 'mode', kind: 'enum', options: [{ value: 'all' }] }]
			},
			{
				id: 'seek',
				label: 'Seek',
				params: [{ name: 'position', kind: 'int', required: true }]
			}
		]
	}
} as unknown as CoreDevice;

const wled = {
	device_id: 'wled_porch',
	name: 'Porch',
	plugin_id: 'plugin.wled',
	available: true,
	attributes: { presets: [{ id: 7, name: 'Autumn' }] },
	schema: {
		attributes: {},
		actions: [
			{
				id: 'apply_preset',
				label: 'Apply a preset',
				params: [
					{
						name: 'preset_id',
						kind: 'int',
						required: true,
						options_from: {
							attribute: { attribute: 'presets', label_key: 'name', value_key: 'id' }
						}
					},
					{ name: 'transition_ms', kind: 'int' }
				]
			}
		]
	}
} as unknown as CoreDevice;

describe('rotations', () => {
	it('finds what a device can choose among: what plays, with one list', () => {
		const s = choiceSources(sonos);
		expect(s.map((x) => x.action.id)).toEqual(['play_favorite', 'play_playlist']);
		expect(s[0]!.options.map((o) => o.label)).toEqual(['ALT Radio', 'Piano for Sleeping']);
		expect(rotatable(sonos)).toBe(true);
		expect(rotatable({ ...sonos, schema: { attributes: {} } } as CoreDevice)).toBe(false);
	});

	it('offers a WLED effect, whose optional segment list is a detail', () => {
		const effects = {
			...wled,
			attributes: { effects: [{ id: 3, name: 'Twinklefox' }] },
			schema: {
				attributes: {},
				actions: [
					{
						id: 'set_effect',
						label: 'Choose an effect',
						params: [
							{
								name: 'effect_id',
								kind: 'int',
								required: true,
								options_from: { attribute: { attribute: 'effects', value_key: 'id' } }
							},
							{ name: 'segment', kind: 'enum', options: [{ value: 'all' }] }
						]
					},
					{ id: 'play_pause', label: 'Play / pause' }
				]
			}
		} as unknown as CoreDevice;
		expect(choiceSources(effects).map((x) => x.action.id)).toEqual(['set_effect']);
	});

	it('makes a WLED preset a number, as the device takes it', () => {
		const [src] = choiceSources(wled);
		const cmd = commandFor(src!, src!.options[0]!);
		expect(cmd).toEqual({ action: 'apply_preset', preset_id: 7 });
		expect(isChoice({ command: cmd }, src!, src!.options[0]!)).toBe(true);
		expect(choiceName({ command: cmd }, [src!])).toBe('Autumn');
		expect(choiceName({ command: cmd })).toBe('7');
		expect(choiceName({ label: 'Fall', command: cmd })).toBe('Fall');
	});

	it('says when a choice plays, and drops what limits nothing', () => {
		const night = (id: string) => (id === 'mode_night' ? 'Night' : id);
		expect(whenWords(undefined, night)).toBe('any time');
		expect(
			whenWords(
				{
					modes: ['mode_night'],
					between: { start: '22:00:00', end: '06:00:00' },
					days: ['Sat', 'Sun']
				},
				night
			)
		).toBe('only when Night is on · 22:00–06:00 · Sat, Sun');
		expect(tidyWhen({ modes: [], days: [] })).toBeUndefined();
		expect(
			tidyWhen({ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] })?.days
		).toHaveLength(7);
		expect(tidyWhen({ days: ['Sun', 'Sat'] })).toEqual({ days: ['Sat', 'Sun'] });
	});

	it('says how often it moves on, in words', () => {
		expect(advanceWords('each_use')).toBe('each time it plays');
		expect(advanceWords({ every: { n: 1, unit: 'day' } })).toBe('every day');
		expect(advanceWords({ every: { n: 2, unit: 'hour' } })).toBe('every 2 hours');
		expect(
			summary({
				choices: [{ command: {} }, { command: {} }],
				order: 'shuffle',
				advance: { every: { n: 1, unit: 'week' } }
			})
		).toBe('2 choices · shuffled · new every week');
	});
});
