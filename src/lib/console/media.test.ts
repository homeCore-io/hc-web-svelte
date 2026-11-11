import { describe, expect, it } from 'vitest';
import type { CoreDevice, DeviceAction, Schema } from '../devices.js';
import {
	appTiles,
	audioChoices,
	currentApp,
	defaultAudio,
	groupOf,
	isCurrent,
	isOn,
	launchCmd,
	muteCmd,
	orderPlayers,
	playerKind,
	playerName,
	pluginFile,
	powerCmd,
	remoteKeys,
	roomAudioOf,
	stepCmd,
	transportOf,
	volumeCmd,
	volumeOf,
	withRoomAudio
} from './media.js';

const COUNT = [
	{ name: 'count', kind: 'int', default: 1, min: 1, max: 100, required: false }
] as const;
const counted = (id: string): DeviceAction => ({ id, label: id, params: [...COUNT] });
const plain = (id: string): DeviceAction => ({ id, label: id });

const ROKU: Schema = {
	attributes: { on: { kind: 'bool', writable: true }, app_name: { kind: 'string' } },
	actions: [
		plain('power_on'),
		plain('power_off'),
		plain('play_pause'),
		counted('volume_up'),
		counted('volume_down'),
		plain('mute'),
		counted('up'),
		counted('down'),
		counted('left'),
		counted('right'),
		counted('select'),
		counted('back'),
		counted('home'),
		{
			id: 'launch_app',
			label: 'Launch',
			params: [
				{
					name: 'app',
					kind: 'enum',
					required: true,
					options_from: {
						attribute: { attribute: 'available_apps', label_key: 'name', value_key: 'id' }
					}
				}
			]
		},
		{
			id: 'key',
			label: 'Key',
			params: [
				{
					name: 'key',
					kind: 'enum',
					required: true,
					options: ['Home', 'Back', 'Select', 'Play', 'Rev', 'Fwd'].map((value) => ({ value }))
				}
			]
		}
	]
};

const SONOS: Schema = {
	attributes: { volume: { kind: 'integer' }, muted: { kind: 'bool' } },
	actions: [
		plain('play'),
		plain('pause'),
		plain('toggle_play_pause'),
		plain('next'),
		plain('previous'),
		{
			id: 'set_volume',
			label: 'Volume',
			params: [{ name: 'volume', kind: 'int', min: 0, max: 100, default: 30, required: true }]
		},
		{
			id: 'set_mute',
			label: 'Mute',
			params: [{ name: 'muted', kind: 'bool', default: true, required: false }]
		}
	]
};

const dev = (
	id: string,
	more: Partial<CoreDevice> = {},
	attributes: Record<string, unknown> = {}
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: 'media_player',
	plugin_id: 'plugin.test',
	available: true,
	attributes,
	...more
});
const roku = (id: string, attributes: Record<string, unknown> = {}) =>
	dev(id, { plugin_id: 'plugin.roku', schema: ROKU }, { on: true, ...attributes });
const sonos = (id: string, attributes: Record<string, unknown> = {}) =>
	dev(
		id,
		{ plugin_id: 'plugin.sonos', schema: SONOS },
		{ volume: 12, muted: false, ...attributes }
	);
const ids = (list: { device_id: string }[]) => list.map((d) => d.device_id);

describe('which players', () => {
	it('tells screens from speakers', () => {
		expect(playerKind(roku('r'))).toBe('screen');
		expect(playerKind(sonos('s'))).toBe('speaker');
		expect(playerKind(dev('t', { device_type: 'tv' }))).toBe('screen');
		expect(playerKind(dev('x', {}, { app_name: 'Netflix' }))).toBe('screen');
		expect(playerKind(dev('y'))).toBe('speaker');
	});

	it('puts screens first, each by name, and leaves out what plays nothing', () => {
		const { screens, speakers } = orderPlayers([
			sonos('Office-2'),
			roku('TV'),
			sonos('Office-1'),
			dev('lamp', { device_type: 'light' })
		]);
		expect(ids(screens)).toEqual(['TV']);
		expect(ids(speakers)).toEqual(['Office-1', 'Office-2']);
	});
});

describe('the room audio', () => {
	const tv = roku('tv');
	const o1 = sonos('o1');
	const o2 = sonos('o2');
	const elsewhere = sonos('kitchen');
	const all = [tv, o1, o2, elsewhere];

	it('is the first screen, else the first speaker, when nobody chose', () => {
		expect(defaultAudio([o2, tv, o1])?.device_id).toBe('tv');
		expect(defaultAudio([o2, o1])?.device_id).toBe('o1');
		expect(defaultAudio([dev('lamp', { device_type: 'light' })])).toBeUndefined();
		expect(roomAudioOf('r', [o1, tv], all)).toEqual({ device: tv, chosen: false });
	});

	it("is the household's choice, which may be in another room", () => {
		expect(roomAudioOf('r', [tv], all, { r: 'kitchen' })).toEqual({
			device: elsewhere,
			chosen: true,
			by: 'house'
		});
	});

	it("is a person's own choice over the household's", () => {
		const r = roomAudioOf('r', [tv, o1], all, { r: 'tv' }, { r: 'o1' });
		expect(r.device?.device_id).toBe('o1');
		expect(r.by).toBe('me');
	});

	it('can be none, though the room has a player', () => {
		expect(roomAudioOf('r', [tv], all, { r: '' })).toEqual({ chosen: true, by: 'house' });
	});

	it('falls back to the default when the chosen device is gone', () => {
		expect(roomAudioOf('r', [tv], all, { r: 'gone' })).toEqual({ device: tv, chosen: false });
		// Something that plays nothing can't be it.
		const lamp = dev('lamp', { device_type: 'light' });
		expect(roomAudioOf('r', [tv], [...all, lamp], { r: 'lamp' }).device).toBe(tv);
	});

	it('reads the devices as a map too', () => {
		const byId = Object.fromEntries(all.map((d) => [d.device_id, d]));
		expect(roomAudioOf('r', [tv], byId, { r: 'o2' }).device).toBe(o2);
	});

	it("offers the room's players first, then the house's", () => {
		const choices = audioChoices([o1, tv], all);
		expect(choices.map((c) => [c.id, c.here])).toEqual([
			['tv', true],
			['o1', true],
			['kitchen', false],
			['o2', false]
		]);
		expect(choices[1]!.label).toBe('o1 · Sonos');
	});

	it('is kept per room, and set back to the default by taking it out', () => {
		const one = withRoomAudio<{ version: number; roomAudio?: Record<string, string> }>(
			{ version: 1 },
			'r',
			'o1'
		);
		expect(one).toEqual({ version: 1, roomAudio: { r: 'o1' } });
		const two = withRoomAudio(one, 's', '');
		expect(two.roomAudio).toEqual({ r: 'o1', s: '' });
		expect(withRoomAudio(withRoomAudio(two, 'r', undefined), 's', undefined)).toEqual({
			version: 1
		});
	});
});

describe('what a screen is showing', () => {
	it('names its app, but not the home screen or an id', () => {
		expect(currentApp(roku('r', { app_name: 'YouTube' }))).toBe('YouTube');
		expect(currentApp(roku('r', { source: 'Home' }))).toBeUndefined();
		expect(currentApp(roku('r', { app_name: 'RINCON_542A1B2C3D4E01400' }))).toBeUndefined();
	});

	it('is off in standby', () => {
		expect(isOn(roku('r'))).toBe(true);
		expect(isOn(roku('r', { on: false }))).toBe(false);
		expect(isOn(roku('r', { power_mode: 'DisplayOff' }))).toBe(false);
	});
});

describe('the apps', () => {
	it('puts inputs first, then the most opened apps, keeping the order for ties', () => {
		const r = roku('r', {
			available_inputs: [{ id: 'tvinput.hdmi1', name: 'HDMI 1' }],
			available_apps: [
				{ id: '12', name: 'Netflix', launches: 0 },
				{ id: '13', name: 'Prime Video', launches: 0 },
				{ id: '837', name: 'YouTube', launches: 4, icon: 'icons/837-2.png' },
				{ name: 'no id' }
			]
		});
		const tiles = appTiles(r);
		expect(tiles.map((t) => t.name)).toEqual(['HDMI 1', 'YouTube', 'Netflix', 'Prime Video']);
		expect(tiles[0]!.input).toBe(true);
		expect(tiles[1]!.icon).toBe('/api/v1/plugins/plugin.roku/files/icons/837-2.png');
		expect(tiles[2]!.icon).toBeUndefined();
		expect(tiles[2]!.letter).toBe('N');
	});

	it('keeps the order when the plugin counts nothing', () => {
		const r = roku('r', {
			available_apps: [
				{ id: '2', name: 'b' },
				{ id: '1', name: '+a' }
			]
		});
		expect(appTiles(r).map((t) => [t.id, t.letter])).toEqual([
			['2', 'B'],
			['1', 'A']
		]);
	});

	it('serves an icon from the plugin, each part of its path made safe', () => {
		expect(pluginFile('plugin.roku', '/icons/a b.png')).toBe(
			'/api/v1/plugins/plugin.roku/files/icons/a%20b.png'
		);
	});

	it('opens one through launch_app', () => {
		const r = roku('r', { available_apps: [{ id: '837', name: 'YouTube' }], app_id: '837' });
		const [yt] = appTiles(r);
		expect(launchCmd(r, yt!)).toEqual({ act: 'launch_app', params: { app: '837' } });
		expect(isCurrent(r, yt!)).toBe(true);
		expect(isCurrent(roku('r', { on: false, app_id: '837' }), yt!)).toBe(false);
	});

	it('has no launch without the action', () => {
		const d = dev('x', {}, { available_apps: [{ id: '1', name: 'A' }] });
		expect(launchCmd(d, appTiles(d)[0]!)).toBeUndefined();
	});
});

describe('the remote', () => {
	it('has the keys the schema declares, by their own actions or the key action', () => {
		const keys = remoteKeys(roku('r'));
		expect(Object.keys(keys).sort()).toEqual(
			[
				'up',
				'down',
				'left',
				'right',
				'ok',
				'back',
				'home',
				'rev',
				'play',
				'fwd',
				'voldown',
				'mute',
				'volup'
			].sort()
		);
		// A count left at its default isn't sent: the plugin's own.
		expect(keys.up!.cmd).toEqual({ act: 'up', params: {} });
		expect(keys.ok!.cmd).toEqual({ act: 'select', params: {} });
		expect(keys.rev!.cmd).toEqual({ act: 'key', params: { key: 'Rev' } });
		expect(keys.play!.cmd).toEqual({ act: 'play_pause', params: {} });
	});

	it('has none without a schema', () => {
		expect(remoteKeys(dev('x'))).toEqual({});
	});

	it('turns a player on and off', () => {
		expect(powerCmd(roku('r'), false)).toEqual({ set: { on: false } });
		const noOn = dev('x', { schema: { attributes: {}, actions: [plain('power_on')] } });
		expect(powerCmd(noOn, true)).toEqual({ act: 'power_on', params: {} });
		expect(powerCmd(dev('y'), true)).toBeUndefined();
	});
});

describe('play and skip', () => {
	it("uses a speaker's toggle, previous and next", () => {
		const t = transportOf(sonos('s', { state: 'playing' }));
		expect(t.playing).toBe(true);
		expect(t.toggle).toEqual({ act: 'toggle_play_pause', params: {} });
		expect(t.previous).toEqual({ act: 'previous', params: {} });
		expect(t.next).toEqual({ act: 'next', params: {} });
	});

	it('plays or pauses where there is no toggle', () => {
		const s = dev('s', { schema: { attributes: {}, actions: [plain('play'), plain('pause')] } });
		expect(transportOf(s).toggle).toEqual({ act: 'play', params: {} });
		expect(transportOf(s, { state: 'playing' }).toggle).toEqual({ act: 'pause', params: {} });
		expect(transportOf(s).next).toBeUndefined();
	});

	it("names who a speaker plays with, the group's leader first", () => {
		const a = sonos('a', { group_members: ['b', 'a', 'c'], group_coordinator: 'c' });
		const all = [a, { ...sonos('b'), name: 'Office-2' }, { ...sonos('c'), name: 'Kitchen' }];
		expect(groupOf(a, all)).toEqual(['Kitchen', 'Office-2']);
		expect(groupOf(sonos('d', { group_members: ['d'] }), all)).toEqual([]);
	});
});

describe('volume', () => {
	it('is a level on a speaker, set through its action and waited for', () => {
		const s = sonos('s');
		expect(volumeOf(s)).toEqual({
			level: { value: 12, min: 0, max: 100 },
			steps: false,
			muted: false,
			canMute: true
		});
		expect(volumeCmd(s, 30.4)).toEqual({
			act: 'set_volume',
			params: { volume: 30 },
			want: { volume: 30 }
		});
		expect(volumeOf(s, { volume: 30 }).level?.value).toBe(30);
	});

	it('is set as an attribute where the attribute is writable', () => {
		const s = dev(
			's',
			{ schema: { attributes: { volume: { kind: 'integer', writable: true, max: 50 } } } },
			{ volume: 5 }
		);
		expect(volumeOf(s).level).toEqual({ value: 5, min: 0, max: 50 });
		expect(volumeCmd(s, 7)).toEqual({ set: { volume: 7 } });
	});

	it('is steps only on a Roku, which reports no level', () => {
		const r = roku('r');
		const v = volumeOf(r);
		expect(v.level).toBeUndefined();
		expect(v.steps).toBe(true);
		expect(v.muted).toBeUndefined();
		expect(v.canMute).toBe(true);
		expect(stepCmd(r, 1)).toEqual({ act: 'volume_up', params: {} });
		expect(stepCmd(r, -1)).toEqual({ act: 'volume_down', params: {} });
		expect(muteCmd(r)).toEqual({ act: 'mute', params: {} });
	});

	it('steps a speaker by its level', () => {
		expect(stepCmd(sonos('s'), 1)).toMatchObject({ params: { volume: 14 } });
		expect(stepCmd(sonos('s', { volume: 1 }), -1)).toMatchObject({ params: { volume: 0 } });
	});

	it('mutes a speaker and unmutes it, waiting for it to say so', () => {
		expect(muteCmd(sonos('s'))).toEqual({
			act: 'set_mute',
			params: { muted: true },
			want: { muted: true }
		});
		expect(muteCmd(sonos('s', { muted: true }))).toMatchObject({ params: { muted: false } });
	});

	it('has nothing to send without a schema', () => {
		const d = dev('x', {}, { volume: 5 });
		expect(volumeOf(d)).toEqual({ steps: false, canMute: false });
		expect(volumeCmd(d, 3)).toBeUndefined();
		expect(muteCmd(d)).toBeUndefined();
		expect(stepCmd(d, 1)).toBeUndefined();
	});
});

describe('names', () => {
	it("leaves off a Roku's serial number and the room's name, unless that leaves a number", () => {
		expect(playerName(dev('a', { name: 'Roku Smart Soundbar - YL0001073725' }))).toBe(
			'Roku Smart Soundbar'
		);
		expect(playerName(dev('b', { name: 'Office TV' }), 'Office')).toBe('TV');
		expect(playerName(dev('c', { name: 'Office-1' }), 'Office')).toBe('Office-1');
		expect(playerName(dev('d', { name: 'x', name_override: 'Den - Speaker' }))).toBe(
			'Den - Speaker'
		);
	});
});
