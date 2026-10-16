/**
 * A made-up house with every kind of device the real one has, in the shapes
 * homeCore sends them — the schema of each plugin as it is, the names and
 * values invented. For tests (P4: tests never touch the live house) and the
 * card gallery at `/dev/cards`.
 */
import type { AttributeSchema, CoreDevice, DeviceAction, ParamSpec, Schema } from '../devices.js';

const NOW = '2026-10-16T12:00:00Z';
const ago = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();

const bool = (writable: boolean, when_true?: string, when_false?: string): AttributeSchema => ({
	kind: 'bool',
	writable,
	...(when_true && when_false
		? { states: { when_true: { label: when_true }, when_false: { label: when_false } } }
		: {})
});
const number = (writable: boolean, extra: Partial<AttributeSchema> = {}): AttributeSchema => ({
	kind: 'float',
	writable,
	...extra
});
const text = (writable = false): AttributeSchema => ({ kind: 'string', writable });
const diag = (spec: AttributeSchema): AttributeSchema => ({ ...spec, category: 'diagnostic' });

function device(
	id: string,
	name: string,
	device_type: string,
	plugin_id: string,
	area: string | undefined,
	attributes: Record<string, unknown>,
	schema: Schema,
	extra: Partial<CoreDevice> = {}
): CoreDevice {
	return {
		device_id: id,
		name,
		device_type,
		plugin_id,
		...(area ? { area } : {}),
		available: true,
		attributes,
		last_seen: NOW,
		schema,
		...extra
	};
}

const lightSchema: Schema = {
	attributes: {
		on: bool(true, 'on', 'off'),
		brightness_pct: { kind: 'integer', writable: true, unit: '%', min: 1, max: 100 },
		color_temp: { kind: 'color_temp', writable: true, unit: 'K', min: 2000, max: 6535 },
		color_xy: { kind: 'color_xy', writable: true },
		effect_values: { kind: 'json', writable: false },
		supports_dimming: diag(bool(false, 'yes', 'no'))
	},
	primary: ['on', 'brightness_pct', 'color_temp', 'color_xy']
};

const BUTTON: ParamSpec = {
	name: 'button',
	kind: 'int',
	label: 'Button',
	required: true,
	options_from: {
		attribute: { attribute: 'available_buttons', label_key: 'name', value_key: 'number' }
	}
};

const rokuActions: DeviceAction[] = [
	...['power_on', 'power_off'].map((id) => ({
		id,
		label: id.replace('_', ' '),
		category: 'Power'
	})),
	...['play', 'pause', 'play_pause', 'stop', 'next', 'previous'].map((id) => ({
		id,
		label: id.replace('_', ' '),
		category: 'Transport',
		params:
			id === 'next' || id === 'previous'
				? [{ name: 'count', kind: 'int', required: false, default: 1 }]
				: []
	})),
	{
		id: 'launch_app',
		label: 'Launch a channel',
		category: 'Apps',
		params: [
			{
				name: 'app',
				kind: 'enum',
				label: 'Channel',
				required: true,
				options_from: {
					attribute: { attribute: 'available_apps', label_key: 'name', value_key: 'id' }
				}
			}
		]
	},
	{
		id: 'select_source',
		label: 'Select a source',
		category: 'Apps',
		writes: 'source',
		params: [
			{
				name: 'source',
				kind: 'enum',
				label: 'Source',
				required: true,
				options_from: { attribute: { attribute: 'available_sources' } }
			}
		]
	}
];

export const HOUSE: CoreDevice[] = [
	device(
		'hue_lamp',
		'Reading lamp',
		'light',
		'plugin.hue',
		'den',
		{
			on: true,
			brightness_pct: 80,
			color_temp: 2700,
			color_xy: { x: 0.45, y: 0.41 },
			supports_dimming: true
		},
		lightSchema
	),
	device(
		'hue_ceiling',
		'Ceiling',
		'light',
		'plugin.hue',
		'den',
		{ on: false, brightness_pct: 100, color_temp: 4000 },
		lightSchema
	),
	device(
		'caseta_porch',
		'Porch',
		'switch',
		'plugin.caseta',
		'outdoor',
		{ on: false },
		{ attributes: { on: bool(true, 'on', 'off') }, primary: ['on'] }
	),
	device(
		'shelly_heater',
		'Heater',
		'switch',
		'plugin.shelly',
		'garage',
		{ on: true, power_w: 1450.5 },
		{
			attributes: { on: bool(true, 'on', 'off'), power_w: number(false, { unit: 'W' }) },
			primary: ['on']
		}
	),
	device(
		'lutron_fan',
		'Ceiling fan',
		'fan',
		'plugin.lutron',
		'den',
		{ on: true, speed: 'medium', speed_pct: 50 },
		{
			attributes: {
				on: bool(true),
				speed: {
					kind: 'enum',
					writable: true,
					options: ['off', 'low', 'medium', 'medium-high', 'high']
				},
				speed_pct: { kind: 'integer', writable: true, unit: '%', min: 0, max: 100 }
			},
			primary: ['on', 'speed', 'speed_pct']
		}
	),
	device(
		'yolink_front_lock',
		'Front door',
		'lock',
		'plugin.yolink',
		'hallway',
		{ locked: true, door_open: false, last_alert: 'Normal', battery: 90 },
		{
			attributes: {
				locked: bool(true, 'locked', 'unlocked'),
				door_open: bool(false, 'open', 'closed'),
				last_alert: text(),
				battery: diag(number(false, { unit: '%' }))
			},
			primary: ['locked', 'door_open']
		}
	),
	device(
		'roku_den',
		'Den TV',
		'media_player',
		'plugin.roku',
		'den',
		{
			on: true,
			state: 'playing',
			app_name: 'Netflix',
			media_title: 'Nature',
			source: 'Netflix',
			available_apps: [
				{ id: '12', name: 'Netflix' },
				{ id: '837', name: 'YouTube' }
			],
			available_sources: ['Netflix', 'YouTube', 'HDMI 1']
		},
		{
			attributes: {
				on: bool(true, 'on', 'off'),
				state: {
					kind: 'enum',
					writable: true,
					options: ['playing', 'paused', 'stopped', 'idle', 'buffering']
				},
				source: text(true),
				app_name: text(),
				media_title: text()
			},
			actions: rokuActions,
			primary: ['state', 'on']
		}
	),
	device(
		'sonos_kitchen',
		'Kitchen speaker',
		'media_player',
		'plugin.sonos',
		'kitchen',
		{ state: 'paused', title: 'Morning', volume: 30 },
		{
			attributes: {
				state: { kind: 'enum', writable: false, options: ['playing', 'paused', 'stopped'] },
				title: text(),
				volume: { kind: 'integer', writable: true, unit: '%', min: 0, max: 100 }
			},
			actions: [
				{ id: 'play', label: 'Play' },
				{ id: 'pause', label: 'Pause' },
				{ id: 'next', label: 'Skip forward' },
				{ id: 'previous', label: 'Skip back' }
			],
			primary: ['state']
		}
	),
	device(
		'mode_night',
		'Night',
		'mode',
		'core.mode',
		undefined,
		{ on: false, kind: 'boolean' },
		{
			attributes: { on: bool(true, 'active', 'inactive'), kind: { kind: 'enum', writable: false } },
			primary: ['on']
		}
	),
	device(
		'timer_laundry',
		'Laundry',
		'timer',
		'core.glue',
		'laundry_room',
		{ state: 'running', remaining_secs: 272, duration_secs: 3600 },
		{
			attributes: {
				state: {
					kind: 'enum',
					writable: false,
					options: ['idle', 'running', 'paused', 'finished', 'cancelled']
				},
				remaining_secs: { kind: 'integer', writable: false, unit: 's' },
				duration_secs: { kind: 'integer', writable: false, unit: 's' }
			},
			primary: ['state', 'remaining_secs']
		}
	),
	device(
		'yolink_back_door',
		'Back door',
		'contact_sensor',
		'plugin.yolink',
		'kitchen',
		{ open: true, battery: 80 },
		{
			attributes: {
				open: bool(false, 'open', 'closed'),
				battery: diag(number(false, { unit: '%' }))
			},
			primary: ['open']
		},
		{ attributes_changed_at: { open: ago(5) } }
	),
	device(
		'yolink_garage_door',
		'Garage door',
		'contact_sensor',
		'plugin.yolink',
		'garage',
		{ open: false },
		{ attributes: { open: bool(false, 'open', 'closed') }, primary: ['open'] }
	),
	device(
		'yolink_leak',
		'Under sink',
		'water_sensor',
		'plugin.yolink',
		'kitchen',
		{ water_detected: false, battery: 12 },
		{
			attributes: {
				water_detected: bool(false, 'wet', 'dry'),
				battery: diag(number(false, { unit: '%' }))
			},
			primary: ['water_detected']
		}
	),
	device(
		'yolink_leak_2',
		'Water heater',
		'water_sensor',
		'plugin.yolink',
		'garage',
		{ water_detected: true },
		{ attributes: { water_detected: bool(false, 'wet', 'dry') }, primary: ['water_detected'] }
	),
	device(
		'hue_motion',
		'Hall motion',
		'motion_sensor',
		'plugin.hue',
		'hallway',
		{ motion: false, temperature: 22.1, illuminance: 26 },
		{
			attributes: {
				motion: bool(false, 'motion', 'clear'),
				temperature: number(false, { unit: '°C' }),
				illuminance: number(false, { unit: 'lux' })
			},
			primary: ['motion', 'temperature', 'illuminance']
		},
		{ attributes_changed_at: { motion: ago(40) } }
	),
	device(
		'lutron_occupancy',
		'Office occupancy',
		'occupancy_sensor',
		'plugin.lutron',
		'office',
		{ occupied: true, occupancy: true },
		{
			attributes: {
				occupied: bool(false, 'occupied', 'vacant'),
				occupancy: bool(false, 'occupied', 'vacant')
			},
			primary: ['occupied', 'occupancy']
		}
	),
	device(
		'ecowitt_den',
		'Den climate',
		'temperature_sensor',
		'plugin.ecowitt',
		'den',
		{ temperature: 70.52, humidity: 45, temperature_unit: '°F' },
		{
			attributes: {
				temperature: number(false),
				humidity: number(false, { unit: '%' }),
				temperature_unit: diag(text())
			},
			primary: ['temperature', 'humidity']
		}
	),
	device(
		'ecowitt_station',
		'Weather',
		'weather_station',
		'plugin.ecowitt',
		'outdoor',
		{ temperature: 57.7, humidity: 94, wind_speed: 1.1 },
		{
			attributes: {
				temperature: number(false),
				humidity: number(false, { unit: '%' }),
				wind_speed: number(false)
			},
			primary: ['temperature', 'humidity']
		}
	),
	device(
		'ecowitt_rain',
		'Rain gauge',
		'rain_sensor',
		'plugin.ecowitt',
		'outdoor',
		{ rain_day_piezo: 0.03, rain_rate_piezo: 0 },
		{
			attributes: { rain_day_piezo: number(false), rain_rate_piezo: number(false) },
			primary: ['rain_day_piezo', 'rain_rate_piezo']
		}
	),
	device(
		'ecowitt_lightning',
		'Lightning',
		'lightning_sensor',
		'plugin.ecowitt',
		'outdoor',
		{ distance: 24, strike_count: 3 },
		{
			attributes: { distance: number(false), strike_count: number(false) },
			primary: ['distance', 'strike_count']
		}
	),
	device(
		'yolink_vibration',
		'Washer',
		'vibration_sensor',
		'plugin.yolink',
		'laundry_room',
		{ vibration: false },
		{ attributes: { vibration: bool(false, 'vibrating', 'still') }, primary: ['vibration'] }
	),
	device(
		'lutron_keypad',
		'Hall keypad',
		'keypad',
		'plugin.lutron',
		'hallway',
		{
			last_button: 2,
			last_button_name: 'Button 2',
			available_buttons: [
				{ name: 'Evening', number: 2 },
				{ name: 'All off', number: 5 }
			]
		},
		{
			attributes: {
				last_button: { kind: 'integer', writable: false },
				last_button_name: text(),
				available_buttons: { kind: 'json', writable: false }
			},
			actions: [
				{
					id: 'press_button',
					label: 'Press a button',
					category: 'Buttons',
					params: [{ ...BUTTON }]
				},
				{
					id: 'set_led',
					label: 'Set a button LED',
					category: 'Buttons',
					params: [
						{ ...BUTTON },
						{
							name: 'state',
							kind: 'enum',
							label: 'LED',
							required: true,
							default: '1',
							options: [
								{ value: '0', label: 'Off' },
								{ value: '1', label: 'On' }
							]
						}
					]
				}
			],
			primary: ['last_button', 'last_button_name']
		},
		{ button_names: { '2': 'Evening' } }
	),
	device(
		'caseta_pico',
		'Bedside remote',
		'pico_remote',
		'plugin.caseta',
		'bedroom',
		{ button_2: 'release' },
		{ attributes: { button_2: text() } }
	),
	device(
		'hue_bridge',
		'Hue bridge',
		'bridge',
		'plugin.hue',
		'office',
		{ online: true, pairing_status: 'paired' },
		{
			attributes: {
				online: bool(false, 'online', 'offline'),
				pairing_status: { kind: 'enum', writable: false }
			},
			actions: [
				{ id: 'refresh', label: 'Refresh devices' },
				{ id: 'pair_bridge', label: 'Pair', confirm: 'Press the bridge button first.' }
			],
			primary: ['online', 'pairing_status']
		}
	),
	device(
		'caseta_scene_movie',
		'Movie time',
		'scene',
		'plugin.caseta',
		'den',
		{},
		{ attributes: {}, actions: [{ id: 'activate', label: 'Activate' }] }
	),
	device(
		'caseta_scene_goodnight',
		'Goodnight',
		'scene',
		'plugin.caseta',
		undefined,
		{},
		{ attributes: {}, actions: [{ id: 'activate', label: 'Activate' }] }
	),
	device(
		'zwave_double',
		'Double switch',
		'zwave',
		'plugin.zwave',
		'kitchen',
		{ ep1_on: true, ep2_on: false },
		{ attributes: { ep1_on: bool(true), ep2_on: bool(true) } },
		{ button_names: { '1': 'Island', '2': 'Sink' } }
	),
	device(
		'matter_blind',
		'Blind',
		'cover',
		'plugin.matter',
		'bedroom',
		{ position: 40 },
		{
			attributes: { position: { kind: 'integer', writable: true, unit: '%', min: 0, max: 100 } },
			primary: ['position']
		}
	),
	device(
		'matter_doorbell',
		'Doorbell',
		'chime',
		'plugin.matter',
		'hallway',
		{},
		{ attributes: {}, actions: [{ id: 'ring', label: 'Ring' }] }
	),
	device(
		'hue_offline',
		'Garden light',
		'light',
		'plugin.hue',
		'outdoor',
		{ on: false },
		lightSchema,
		{ available: false, last_seen: ago(180) }
	)
];

export const ROOMS = [
	{ id: 'r-den', name: 'Den', slug: 'den', aliases: ['tv_room'], device_ids: [] },
	{ id: 'r-kitchen', name: 'Kitchen', slug: 'kitchen', device_ids: [] },
	{ id: 'r-garage', name: 'Garage', slug: 'garage', device_ids: [] },
	{ id: 'r-hall', name: 'Hallway', slug: 'hallway', device_ids: [] },
	{ id: 'r-office', name: 'Office', slug: 'office', device_ids: [] },
	{ id: 'r-outdoor', name: 'Outdoor', slug: 'outdoor', device_ids: [] },
	{ id: 'r-laundry', name: 'Laundry Room', slug: 'laundry_room', device_ids: [] },
	{ id: 'r-bedroom', name: 'Bedroom', slug: 'bedroom', device_ids: [] }
];

export const FIXTURE_NOW = Date.parse(NOW);
