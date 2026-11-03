/**
 * A player's remote pad (13 §13.1, Firemote; H2): its buttons laid out as a
 * remote, from what its plugin declares, so any player can have one and the
 * app knows nothing of a particular plugin. A button is a named action
 * (`volume_up`), or one of the options of a `key` action (a Roku's `Up`).
 * A player gets a pad only when it has the arrows and OK.
 */
import type { Schema } from './devices.js';

export type PadButton =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'ok'
	| 'back'
	| 'home'
	| 'options'
	| 'replay'
	| 'play'
	| 'volumeDown'
	| 'mute'
	| 'volumeUp';

/** What a button sends: an action, with its key where it's one of a `key` action's. */
export interface Press {
	action: string;
	params: Record<string, unknown>;
	label: string;
}

const WAYS: Record<PadButton, { actions: string[]; keys: string[]; label: string }> = {
	up: { actions: ['up'], keys: ['up'], label: 'Up' },
	down: { actions: ['down'], keys: ['down'], label: 'Down' },
	left: { actions: ['left'], keys: ['left'], label: 'Left' },
	right: { actions: ['right'], keys: ['right'], label: 'Right' },
	ok: { actions: ['select', 'ok', 'enter'], keys: ['select', 'ok', 'enter'], label: 'OK' },
	back: { actions: ['back'], keys: ['back'], label: 'Back' },
	home: { actions: ['home'], keys: ['home'], label: 'Home' },
	options: {
		actions: ['menu', 'options', 'info'],
		keys: ['info', 'options', 'menu'],
		label: 'Options'
	},
	replay: { actions: ['instant_replay'], keys: ['instantreplay'], label: 'Replay' },
	play: { actions: ['play_pause'], keys: ['play', 'playpause'], label: 'Play or pause' },
	volumeDown: { actions: ['volume_down'], keys: ['volumedown'], label: 'Volume down' },
	mute: { actions: ['mute'], keys: ['volumemute', 'mute'], label: 'Mute' },
	volumeUp: { actions: ['volume_up'], keys: ['volumeup'], label: 'Volume up' }
};

/** A player's pad: each button it has; none without the arrows and OK. */
export function remoteOf(
	schema: Schema | null | undefined
): Partial<Record<PadButton, Press>> | null {
	const actions = schema?.actions ?? [];
	const ids = new Set(actions.map((a) => a.id));
	const keyAction = actions.find((a) => a.id === 'key' && a.params?.some((p) => p.name === 'key'));
	const keyOptions = keyAction?.params?.find((p) => p.name === 'key')?.options ?? [];
	const out: Partial<Record<PadButton, Press>> = {};
	for (const [button, way] of Object.entries(WAYS) as [PadButton, (typeof WAYS)[PadButton]][]) {
		const named = way.actions.find((a) => ids.has(a));
		if (named) {
			out[button] = { action: named, params: {}, label: way.label };
			continue;
		}
		const key = keyOptions.find((o) => way.keys.includes(o.value.toLowerCase()));
		if (key) out[button] = { action: 'key', params: { key: key.value }, label: way.label };
	}
	const pad: PadButton[] = ['up', 'down', 'left', 'right', 'ok'];
	return pad.every((b) => out[b]) ? out : null;
}
