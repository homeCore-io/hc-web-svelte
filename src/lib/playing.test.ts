import { describe, expect, it } from 'vitest';
import type { CoreDevice } from './devices.js';
import { playingIds, playNow } from './playing.js';

const sonos = (id: string, attributes: Record<string, unknown>, more: Partial<CoreDevice> = {}) =>
	({
		device_id: id,
		name: id,
		device_type: 'media_player',
		plugin_id: 'plugin.sonos',
		available: true,
		attributes,
		...more
	}) as CoreDevice;

describe('what a player is doing', () => {
	it('says a Sonos playing its own id is playing a TV or line-in', () => {
		const lr = sonos('lr', { state: 'playing', media_title: 'RINCON_542A1B8710A901400' });
		expect(playNow(lr, [lr])).toMatchObject({ state: 'playing', what: 'TV or line-in' });
		const x = sonos('x', { state: 'playing', media_title: 'x-rincon-stream:RINCON_542A1B87' });
		expect(playNow(x, [x])).toMatchObject({ state: 'playing', what: 'TV or line-in' });
	});

	it('counts a group once, by its leader; a follower is grouped', () => {
		const lead = sonos('a', { state: 'playing', media_title: 'Song', group_coordinator: 'a' });
		const follower = sonos('b', { state: 'playing', media_title: 'Song', group_coordinator: 'a' });
		const all = [lead, follower];
		expect(playNow(follower, all)).toMatchObject({ state: 'grouped', lead: 'a' });
		expect([...playingIds({ a: lead, b: follower })]).toEqual(['a']);
		// Its leader gone from the house, it plays on its own.
		expect(playNow(follower, [follower]).state).toBe('playing');
	});

	it('says paused only with something queued, else idle', () => {
		expect(playNow(sonos('a', { state: 'paused', media_title: 'ALT Radio' }), []).state).toBe(
			'paused'
		);
		expect(playNow(sonos('b', { state: 'paused' }), []).state).toBe('idle');
	});

	it('is off, or offline, before anything else', () => {
		expect(playNow(sonos('a', { state: 'playing', on: false }), []).state).toBe('off');
		expect(playNow(sonos('a', { state: 'playing' }, { available: false }), []).state).toBe(
			'offline'
		);
	});

	it('takes a command on its way', () => {
		const a = sonos('a', { state: 'playing', media_title: 'Song' });
		expect(playNow(a, [a], { state: 'paused' }).state).toBe('paused');
		expect(playingIds({ a }, { a: { want: { state: 'paused' } } }).size).toBe(0);
	});

	it('says a screen in an app is open, and playing when it plays', () => {
		const roku = (attributes: Record<string, unknown>) =>
			({ ...sonos('r', attributes), plugin_id: 'plugin.roku' }) as CoreDevice;
		expect(playNow(roku({ state: 'playing', app_name: 'YouTube' }), [])).toMatchObject({
			state: 'playing',
			what: 'YouTube',
			screen: true
		});
		expect(playNow(roku({ state: 'idle', source: 'HDMI 1' }), []).state).toBe('open');
		expect(playNow(roku({ state: 'idle', source: 'Home' }), []).state).toBe('idle');
	});
});
