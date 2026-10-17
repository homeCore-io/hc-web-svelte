import { describe, expect, it } from 'vitest';
import { cardFor, epochOf, type CardView } from './card.js';
import { HOUSE, FIXTURE_NOW } from './fixtures/house.js';
import type { CoreDevice } from './devices.js';

const byId = (id: string): CoreDevice => {
	const d = HOUSE.find((x) => x.device_id === id);
	if (!d) throw new Error(id);
	return d;
};
const card = (id: string, patch: Partial<CoreDevice> = {}): CardView =>
	cardFor({ ...byId(id), ...patch }, FIXTURE_NOW);

describe('cards for the kinds in this house (03 §3)', () => {
	it('a light: on and how bright, a switch, brightness and warmth in Large', () => {
		const c = card('hue_lamp');
		expect(c.stateLine).toBe('On · 80%');
		expect(c.control).toEqual({ kind: 'switch', attr: 'on', on: true });
		expect(c.extras.map((e) => (e.kind === 'slider' ? e.label : e.kind))).toEqual([
			'Brightness',
			'Warmth'
		]);
		expect(card('hue_ceiling').stateLine).toBe('Off');
	});

	it('a switch says how much power it draws', () => {
		expect(card('shelly_heater').stateLine).toBe('On · 1450.5 W');
		expect(card('caseta_porch').stateLine).toBe('Off');
	});

	it('a fan: speed in words, speed steps without "off"', () => {
		const c = card('lutron_fan');
		expect(c.stateLine).toBe('On · medium');
		expect(c.extras[0]).toMatchObject({
			kind: 'steps',
			options: ['low', 'medium', 'medium-high', 'high']
		});
	});

	it('a lock offers lock or unlock by its state (C4)', () => {
		expect(card('yolink_front_lock').control).toEqual({ kind: 'lock', locked: true });
		const open = card('yolink_front_lock', {
			attributes: { locked: false, door_open: true }
		});
		expect(open.stateLine).toBe('Unlocked · door open');
		expect(open.icon).toBe('unlock');
	});

	it('a jammed lock is alarming (C9)', () => {
		const c = card('yolink_front_lock', {
			attributes: { locked: false, last_alert: 'LockJammed' }
		});
		expect(c.alarm).toBe('jammed');
		expect(c.tone).toBe('alert');
	});

	it('a TV: what is playing, and play/pause', () => {
		const c = card('roku_den');
		expect(c.stateLine).toBe('Playing — Nature');
		expect(c.control).toEqual({ kind: 'play', playing: true, action: 'play_pause' });
		expect(c.icon).toBe('tv');
		const off = card('roku_den', { attributes: { on: false, state: 'idle' } });
		expect(off.stateLine).toBe('Off');
		expect(off.control).toEqual({ kind: 'switch', attr: 'on', on: false });
	});

	it('a speaker without play_pause plays or pauses by its state, with volume in Large', () => {
		const c = card('sonos_kitchen');
		expect(c.icon).toBe('speaker');
		expect(c.stateLine).toBe('Paused — Morning');
		expect(c.control).toEqual({ kind: 'play', playing: false, action: 'play' });
		expect(c.extras.map((e) => e.kind)).toEqual(['transport', 'slider']);
	});

	it('a speaker shows its artwork, from homeCore, changing with the track', () => {
		const sonos = byId('sonos_kitchen');
		const playing = (attrs: Record<string, unknown>) =>
			cardFor(
				{ ...sonos, attributes: { ...sonos.attributes, state: 'playing', ...attrs } },
				FIXTURE_NOW
			);
		const a = playing({
			media_image_url: 'http://10.0.10.28:1400/getaa?u=one',
			media_artist: 'Nils'
		});
		expect(a.art).toMatch(/^\/api\/v1\/devices\/sonos_kitchen\/media\/art\?t=/);
		expect(a.artLogo).toBeUndefined();
		const b = playing({
			media_image_url: 'http://10.0.10.28:1400/getaa?u=two',
			media_artist: 'Nils'
		});
		expect(b.art).not.toBe(a.art);
		expect(playing({ media_image_url: '' }).art).toBeUndefined();
	});

	it('a radio station: its logo whole, never its stream’s address as the title', () => {
		const sonos = byId('sonos_kitchen');
		const radio = cardFor(
			{
				...sonos,
				attributes: {
					on: true,
					state: 'playing',
					media_title: 'hls.m3u8?rj-ttl=5&rj-tok=AAAB',
					title: 'hls.m3u8?rj-ttl=5&rj-tok=AAAB',
					media_image_url: 'http://10.0.10.28:1400/getaa?s=1&u=x-sonosapi-hls'
				}
			},
			FIXTURE_NOW
		);
		expect(radio.stateLine).toBe('Playing');
		expect(radio.art).toBeDefined();
		expect(radio.artLogo).toBe(true);
	});

	it('a timer counts down, and homeCore timers can be started and cancelled', () => {
		const c = card('timer_laundry');
		expect(c.stateLine).toBe('Running · 4:32 left');
		expect(c.control).toEqual({ kind: 'timer', running: true, durationSecs: 3600 });
	});

	it('a door says how long it has been open', () => {
		expect(card('yolink_back_door').stateLine).toBe('Open · 5 min');
		expect(card('yolink_garage_door').stateLine).toBe('Closed');
	});

	it('a leak is alarming, and so is a low battery', () => {
		expect(card('yolink_leak_2')).toMatchObject({ stateLine: 'Wet', alarm: 'wet', tone: 'alert' });
		expect(card('yolink_leak')).toMatchObject({ stateLine: 'Dry', alarm: 'low battery' });
	});

	it('motion and occupancy use the device’s own words', () => {
		expect(card('hue_motion').stateLine).toBe('Clear for 40 min');
		expect(card('lutron_occupancy').stateLine).toBe('Occupied');
	});

	it('readings carry their units, from the schema or a _unit sibling', () => {
		expect(card('ecowitt_den').stateLine).toBe('70.5°F · 45%');
		expect(card('ecowitt_station').stateLine).toBe('57.7° · 94%');
	});

	it('a keypad names its last button, by the person’s name for it', () => {
		expect(card('lutron_keypad').stateLine).toBe('Last: Evening');
		expect(card('lutron_keypad').control).toBeNull();
	});

	it('infrastructure is shown like any device (C6)', () => {
		expect(card('hue_bridge')).toMatchObject({
			stateLine: 'Online',
			icon: 'router',
			control: null
		});
	});

	it('a multi-channel device is one card with a switch per channel (C7)', () => {
		const c = card('zwave_double');
		expect(c.channels).toEqual([
			{ attr: 'ep1_on', label: 'Island', on: true },
			{ attr: 'ep2_on', label: 'Sink', on: false }
		]);
		expect(c.stateLine).toBe('1 of 2 on');
		expect(c.control).toBeNull();
	});
});

describe('the generic rule (03 §4)', () => {
	it('a cover of no tuned kind: its reading, and a slider in Large', () => {
		const c = card('matter_blind');
		expect(c.stateLine).toBe('40%');
		expect(c.control).toBeNull();
		expect(c.extras[0]).toMatchObject({ kind: 'slider', attr: 'position', min: 0, max: 100 });
	});

	it('exactly one parameterless action becomes the card’s button', () => {
		expect(card('matter_doorbell').control).toEqual({
			kind: 'button',
			label: 'Ring',
			action: 'ring',
			confirm: undefined
		});
	});

	it('a writable on is a switch, whatever the kind', () => {
		const d: CoreDevice = {
			device_id: 'x',
			name: 'Thing',
			device_type: 'mystery',
			available: true,
			attributes: { on: true },
			schema: { attributes: { on: { kind: 'bool', writable: true } } }
		};
		expect(cardFor(d).control).toEqual({ kind: 'switch', attr: 'on', on: true });
	});
});

describe('every card', () => {
	it('never offers a control the device does not declare writable', () => {
		const readOnly: CoreDevice = {
			...byId('hue_lamp'),
			schema: { attributes: { on: { kind: 'bool', writable: false } } }
		};
		const c = cardFor(readOnly, FIXTURE_NOW);
		expect(c.control).toBeNull();
		expect(c.extras).toEqual([]);
	});

	it('an offline device says for how long, and is alarming', () => {
		expect(card('hue_offline')).toMatchObject({
			stateLine: 'Offline · 3 h',
			tone: 'alert',
			alarm: 'offline',
			available: false
		});
	});

	it('says when it was changed at the wall, or by a rule', () => {
		const at = new Date(FIXTURE_NOW - 60_000).toISOString();
		expect(card('hue_lamp', { last_change: { kind: 'physical', changed_at: at } }).stateLine).toBe(
			'On · 80% · at the wall'
		);
		expect(
			card('hue_lamp', {
				last_change: { kind: 'homecore', source: 'rule', actor_name: 'Evening', changed_at: at }
			}).stateLine
		).toBe('On · 80% · by Evening');
	});

	it('a sensor silent for a day says how long', () => {
		const old = new Date(FIXTURE_NOW - 3 * 86_400_000).toISOString();
		expect(card('yolink_garage_door', { last_seen: old }).stateLine).toBe('Closed · 3 d ago');
	});

	it('a person’s hint wins over the plugin’s type', () => {
		expect(card('caseta_porch', { ui_hint: 'light' }).icon).toBe('light');
	});

	it('every device in the house gets a card with something to say', () => {
		for (const d of HOUSE) {
			const c = cardFor(d, FIXTURE_NOW);
			expect(c.stateLine, d.device_id).not.toBe('');
		}
	});
});

it('reads Unix seconds named like a time as a moment, and nothing else', () => {
	expect(epochOf('last_strike', '1792109048')).toBe(1792109048000);
	expect(epochOf('updated_at', 1792109048)).toBe(1792109048000);
	expect(epochOf('strike_count', 1792109048)).toBeUndefined();
	expect(epochOf('last_strike', '22')).toBeUndefined();
});
