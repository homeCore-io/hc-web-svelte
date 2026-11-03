import { describe, expect, it } from 'vitest';
import { remoteOf } from './remote.js';
import type { Schema } from './devices.js';

const roku: Schema = {
	attributes: {},
	actions: [
		{ id: 'volume_up', label: 'Volume up' },
		{ id: 'play_pause', label: 'Play/pause' },
		{
			id: 'key',
			label: 'Press a button',
			params: [
				{
					name: 'key',
					kind: 'enum',
					options: [
						'Home',
						'Back',
						'Select',
						'Left',
						'Right',
						'Up',
						'Down',
						'Info',
						'VolumeMute'
					].map((value) => ({ value }))
				}
			]
		}
	]
};

describe('a player’s remote pad, from what it declares (H2)', () => {
	it('lays out a key action’s buttons, and prefers a named action', () => {
		const pad = remoteOf(roku)!;
		expect(pad.up).toEqual({ action: 'key', params: { key: 'Up' }, label: 'Up' });
		expect(pad.ok?.params).toEqual({ key: 'Select' });
		expect(pad.options?.params).toEqual({ key: 'Info' });
		expect(pad.volumeUp).toEqual({ action: 'volume_up', params: {}, label: 'Volume up' });
		expect(pad.mute?.params).toEqual({ key: 'VolumeMute' });
		expect(pad.replay).toBeUndefined();
	});

	it('gives no pad to a player without the arrows and OK', () => {
		expect(remoteOf({ attributes: {}, actions: [{ id: 'volume_up', label: 'Up' }] })).toBeNull();
		expect(remoteOf(undefined)).toBeNull();
	});
});
