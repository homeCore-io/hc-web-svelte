/**
 * A made-up house's rules, in the shapes homeCore sends them — the kinds the
 * real house uses (doc 09 §1), with names and ids invented. Devices carry the
 * schemas their plugins declare: a door that "opens", a keypad whose action
 * reads "set the LED of button {button} on {device} to {state}".
 */
import type { CoreDevice } from '../devices.js';
import type { Rule } from '../ruleWords.js';

const dev = (d: Partial<CoreDevice> & { device_id: string; name: string }): CoreDevice =>
	({
		attributes: {},
		available: true,
		...d
	}) as CoreDevice;

export const DEVICES: CoreDevice[] = [
	dev({
		device_id: 'zz_door_1',
		name: 'Pantry Door',
		canonical_name: 'pantry.pantry_door',
		device_type: 'contact_sensor',
		schema: {
			attributes: {
				open: {
					kind: 'bool',
					writable: false,
					display_name: 'Door',
					states: {
						when_true: { label: 'open', verb: 'opens' },
						when_false: { label: 'closed', verb: 'closes' }
					}
				}
			},
			primary: ['open']
		}
	}),
	dev({
		device_id: 'zz_door_2',
		name: 'Porch Door',
		device_type: 'contact_sensor',
		schema: {
			attributes: {
				open: {
					kind: 'bool',
					writable: false,
					states: {
						when_true: { label: 'open', verb: 'opens' },
						when_false: { label: 'closed', verb: 'closes' }
					}
				}
			},
			primary: ['open']
		}
	}),
	...['Reading Lamp', 'Corner Lamp'].map((name, i) =>
		dev({
			device_id: `zz_lamp_${i + 1}`,
			name,
			device_type: 'light',
			schema: {
				attributes: {
					on: { kind: 'bool', writable: true, display_name: 'Power' },
					brightness: {
						kind: 'integer',
						writable: true,
						min: 0,
						max: 100,
						unit: '%',
						display_name: 'Brightness'
					}
				},
				primary: ['on']
			}
		})
	),
	dev({
		device_id: 'zz_keypad',
		name: 'Den Keypad',
		device_type: 'keypad',
		schema: {
			attributes: { button_1: { kind: 'string', writable: false, display_name: 'Button 1' } },
			actions: [
				{
					id: 'set_led',
					label: 'Set a button LED',
					sentence: 'set the LED of button {button} on {device} to {state}',
					params: [
						{ name: 'button', kind: 'int', required: true },
						{
							name: 'state',
							kind: 'enum',
							options: [
								{ value: '0', label: 'Off' },
								{ value: '1', label: 'On' }
							]
						}
					]
				}
			] as never
		}
	}),
	dev({
		device_id: 'zz_speaker_den',
		name: 'Den',
		canonical_name: 'den',
		device_type: 'media_player',
		schema: {
			attributes: { volume: { kind: 'integer', writable: true, min: 0, max: 100 } },
			actions: [
				{
					id: 'set_volume',
					label: 'Set volume',
					sentence: 'set the volume of {device} to {volume}',
					params: [{ name: 'volume', kind: 'int', unit: '%', required: true }]
				},
				{
					id: 'play_favorite',
					label: 'Play a favourite',
					sentence: 'play the favourite {favorite} on {device}',
					params: [{ name: 'favorite', kind: 'string', required: true }]
				}
			] as never
		}
	}),
	dev({
		device_id: 'timer_den_fan',
		name: 'Den Fan Timer',
		plugin_id: 'core.glue',
		device_type: 'timer',
		schema: {
			attributes: {
				state: { kind: 'enum', writable: false, options: ['idle', 'running', 'finished'] }
			}
		}
	}),
	dev({
		device_id: 'mode_night',
		name: 'Night',
		plugin_id: 'core.mode',
		device_type: 'mode',
		schema: {
			attributes: {
				on: {
					kind: 'bool',
					writable: true,
					states: { when_true: { label: 'on' }, when_false: { label: 'off' } }
				}
			}
		}
	}),
	dev({
		device_id: 'zz_air',
		name: 'Den Air',
		device_type: 'temperature_sensor',
		schema: {
			attributes: {
				temperature: { kind: 'float', writable: false, unit: '°C' },
				humidity_pct: { kind: 'integer', writable: false, unit: '%', display_name: 'Humidity' }
			},
			primary: ['temperature']
		}
	})
];

const rule = (r: Partial<Rule> & { id: string; name: string; trigger: unknown }): Rule => ({
	enabled: true,
	priority: 0,
	tags: [],
	conditions: [],
	actions: [],
	...r
});
const set = (device_id: string, state: unknown) => ({
	action: { SetDeviceState: { device_id, state, track_event_value: false } },
	enabled: true
});
const is = (device_id: string, attribute: string, op: string, value: unknown) => ({
	DeviceState: { device_id, attribute, op, value }
});

export const RULES: Rule[] = [
	rule({
		id: 'r-door',
		name: 'Pantry Door - Opened',
		tags: ['pantry'],
		trigger: { DeviceStateChanged: { device_id: 'zz_door_1', attribute: 'open', to: true } },
		actions: [
			set('zz_lamp_1', { on: true }),
			set('timer_den_fan', { command: 'start', duration_secs: 300 })
		]
	}),
	rule({
		id: 'r-btn-on',
		name: 'Keypad Btn1 - Den On',
		tags: ['den'],
		trigger: { DeviceStateChanged: { device_id: 'zz_keypad', attribute: 'button_1', to: 'press' } },
		conditions: [is('zz_lamp_1', 'on', 'Eq', false), is('zz_lamp_2', 'on', 'Eq', false)],
		actions: [
			set('zz_lamp_1', { on: true }),
			set('zz_lamp_2', { on: true }),
			set('zz_keypad', { set_led: { button: 1, state: 1 } })
		]
	}),
	rule({
		id: 'r-btn-off',
		name: 'Keypad Btn1 - Den Off',
		tags: ['den'],
		trigger: { DeviceStateChanged: { device_id: 'zz_keypad', attribute: 'button_1', to: 'press' } },
		conditions: [
			{ Or: { conditions: [is('zz_lamp_1', 'on', 'Eq', true), is('zz_lamp_2', 'on', 'Eq', true)] } }
		],
		actions: [set('zz_lamp_1', { on: false }), set('zz_lamp_2', { on: false })]
	}),
	rule({
		id: 'r-music-am',
		name: 'Den - Music on Close (Morning)',
		tags: ['den'],
		trigger: { DeviceStateChanged: { device_id: 'zz_door_2', attribute: 'open', to: false } },
		conditions: [{ TimeWindow: { start: '06:00:00', end: '12:00:00' } }],
		// "den" is the speaker's name in rules, as a rule written by hand says it.
		actions: [
			set('zz_speaker_den', { action: 'set_volume', volume: 15 }),
			set('den', { action: 'play_favorite', favorite: 'Morning Piano' })
		]
	}),
	rule({
		id: 'r-music-pm',
		name: 'Den - Music on Close (Afternoon)',
		tags: ['den'],
		trigger: { DeviceStateChanged: { device_id: 'zz_door_2', attribute: 'open', to: false } },
		conditions: [{ TimeWindow: { start: '12:00:00', end: '23:59:00' } }],
		actions: [set('zz_speaker_den', { action: 'play_favorite', favorite: 'Radio' })]
	}),
	rule({
		id: 'r-start-1',
		name: 'Startup Check - Pantry Door Open',
		tags: ['pantry', 'startup'],
		trigger: 'SystemStarted',
		conditions: [is('zz_door_1', 'open', 'Eq', true)],
		actions: [
			{
				action: {
					Notify: { channel: 'telegram', message: 'Pantry door was open at start', title: null }
				},
				enabled: true
			}
		]
	}),
	rule({
		id: 'r-start-2',
		name: 'Startup Check - Porch Door Open',
		enabled: false,
		trigger: 'SystemStarted',
		conditions: [is('zz_door_2', 'open', 'Eq', true)],
		actions: [set('timer_den_fan', { command: 'start' })]
	}),
	rule({
		id: 'r-night',
		name: 'Porch Door - Night Light',
		trigger: {
			DeviceStateChanged: {
				device_id: 'zz_door_2',
				device_ids: ['zz_door_1'],
				attribute: 'open',
				to: true
			}
		},
		actions: [
			{
				action: {
					Conditional: {
						condition: 'device_state("mode_night")["on"] == true',
						then_actions: [
							{
								SetDeviceState: {
									device_id: 'zz_lamp_2',
									state: { on: true, brightness: 30 },
									track_event_value: false
								}
							}
						],
						else_actions: [],
						else_if: []
					}
				},
				enabled: true
			}
		]
	}),
	rule({
		id: 'r-gone',
		name: 'Old Lamp Off',
		enabled: false,
		error: "device reference 'zz_old_lamp' did not match any known device",
		trigger: { SunEvent: { event: 'Sunrise', offset_minutes: -30 } },
		actions: [set('DELETED:zz_old_lamp', { on: false }), set('reading_lamp', { on: false })]
	}),
	rule({
		id: 'r-dry',
		name: 'Den Humidity Low',
		tags: ['den'],
		trigger: { DeviceStateChanged: { device_id: 'zz_air', attribute: 'humidity_pct' } },
		conditions: [
			is('zz_air', 'humidity_pct', 'Lt', 35),
			{ ModeIs: { mode_id: 'mode_night', on: false } }
		],
		actions: [
			{ action: { Delay: { duration_secs: 90, cancelable: false } }, enabled: true },
			{
				action: {
					Parallel: {
						actions: [
							{
								SetDeviceState: {
									device_id: 'zz_lamp_1',
									state: { on: true },
									track_event_value: false
								}
							}
						]
					}
				},
				enabled: false
			}
		],
		cooldown_secs: 600,
		run_mode: 'Single'
	})
];
