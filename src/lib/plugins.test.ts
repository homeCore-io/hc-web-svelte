import { describe, expect, it, test } from 'vitest';
import {
	resultLines,
	buttonOf,
	dangerous,
	isRunning,
	compareVersions,
	latestOf,
	needsCore,
	notInstalled,
	paramDefaults,
	paramFields,
	rowsOf,
	runAfter,
	startRun,
	stateOf,
	updateOf,
	type PluginRecord,
	type RegistryPlugin,
	type Run
} from './plugins.js';

const NOW = Date.parse('2026-10-16T15:00:00Z');
const rec = (p: Partial<PluginRecord>): PluginRecord => ({
	plugin_id: 'plugin.hue',
	status: 'active',
	enabled: true,
	managed: true,
	restart_count: 0,
	device_count: 49,
	supports_management: true,
	...p
});
const reg = (id: string, name: string, versions: string[]): RegistryPlugin => ({
	id,
	name,
	description: `${name} things`,
	versions: versions.map((version) => ({
		version,
		artifacts: [{ os: 'linux', arch: 'x86_64', size: 4_194_304 }]
	}))
});
const REGISTRY = [
	reg('plugin.hue', 'Hue', ['0.1.9', '0.1.17', '0.1.16']),
	reg('plugin.isy', 'Isy', ['0.1.11'])
];

describe('versions', () => {
	test('by number, not by letter', () => {
		expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0);
		expect(compareVersions('v1.2.0', '1.2')).toBe(0);
		expect(latestOf(REGISTRY[0])).toBe('0.1.17');
	});
	test('an update is a newer version in the registry', () => {
		expect(updateOf(rec({ version: '0.1.16' }), REGISTRY[0])).toBe('0.1.17');
		expect(updateOf(rec({ version: '0.1.17' }), REGISTRY[0])).toBeUndefined();
		expect(updateOf(rec({ installed_version: '0.1.9' }), REGISTRY[0])).toBe('0.1.17');
		expect(updateOf(rec({}), REGISTRY[0])).toBeUndefined();
		// A version that needs a newer homeCore isn't offered.
		const needy = {
			...REGISTRY[0]!,
			versions: REGISTRY[0]!.versions.map((v) =>
				v.version === '0.1.17' ? { ...v, min_core: '0.1.90' } : v
			)
		};
		expect(latestOf(needy, '0.1.81')).not.toBe('0.1.17');
		expect(latestOf(needy, '0.1.90')).toBe('0.1.17');
		expect(updateOf(rec({ version: '0.1.16' }), needy, '0.1.81')).toBeUndefined();
		expect(
			needsCore(
				needy.versions.find((v) => v.version === '0.1.17'),
				'0.1.81'
			)
		).toBe('0.1.90');
		expect(
			needsCore(
				needy.versions.find((v) => v.version === '0.1.17'),
				null
			)
		).toBeUndefined();
	});
});

describe('how it is, in words', () => {
	test('running, off, not answering', () => {
		expect(stateOf(rec({ uptime_started: '2026-10-16T13:07:00Z' }), NOW).word).toBe('Running');
		// Settings and System count "running" the way this list says it.
		for (const r of [rec({}), rec({ enabled: false }), rec({ status: 'offline' })])
			expect(isRunning(r)).toBe(stateOf(r, NOW).word === 'Running');
		expect(stateOf(rec({ enabled: false }), NOW)).toEqual({
			word: 'Turned off',
			detail: '',
			tone: 'quiet'
		});
		expect(
			stateOf(rec({ status: 'offline', last_heartbeat: '2026-10-16T12:00:00Z' }), NOW)
		).toEqual({
			word: 'Not answering',
			detail: 'last heard 3 h ago',
			tone: 'bad'
		});
	});

	test('the list: names from the registry, worst notice, updates', () => {
		const rows = rowsOf(
			[
				rec({
					version: '0.1.16',
					notices: [
						{ level: 'info', code: 'a', message: 'fine' },
						{ level: 'error', code: 'b', message: 'Bridge unreachable' }
					]
				}),
				rec({ plugin_id: 'plugin.yolink', device_count: 28 })
			],
			REGISTRY,
			NOW
		);
		expect(rows.map((r) => [r.name, r.update, r.notice?.message])).toEqual([
			['Hue', '0.1.17', 'Bridge unreachable'],
			['YoLink', undefined, undefined]
		]);
		expect(notInstalled(REGISTRY, [rec({})]).map((r) => r.name)).toEqual(['ISY']); // the house's spelling, not the registry's "Isy"
	});
});

describe('actions', () => {
	const pair = {
		id: 'pair_bridge',
		label: 'Pair Hue bridge',
		stream: true,
		params: {
			host: { type: 'string', title: 'Address' },
			timeout: { type: 'integer', default: 30, minimum: 5 },
			mode: { type: 'string', enum: ['auto', 'manual'], default: 'auto' }
		}
	};
	test('parameters as fields, with their defaults', () => {
		expect(paramFields(pair).map((f) => [f.kind, f.label])).toEqual([
			['text', 'Address'],
			['number', 'Timeout'],
			['choice', 'Mode']
		]);
		expect(paramDefaults(pair)).toEqual({ timeout: 30, mode: 'auto' });
		expect(buttonOf(pair)).toBe('Start…');
		expect(buttonOf({ id: 'remove_bridge', label: 'Remove bridge' })).toBe('Remove…');
		expect(buttonOf({ id: 'refresh', label: 'Refresh' })).toBe('Run');
		// A plugin that says an action is dangerous is asked first, whatever its name.
		expect(dangerous({ id: 'recalibrate', label: 'Recalibrate', danger: true })).toBe(true);
		expect(dangerous({ id: 'reboot', label: 'Reboot devices' })).toBe(true);
		expect(dangerous({ id: 'refresh', label: 'Refresh' })).toBe(false);
		expect(buttonOf({ id: 'recalibrate', label: 'Recalibrate', danger: true })).toBe('Run…');
	});
});

describe('an action talking back', () => {
	const after = (...events: Parameters<typeof runAfter>[1][]) =>
		events.reduce((r: Run, e) => runAfter(r, e), startRun());

	test('progress, findings, and the end', () => {
		const r = after(
			{ stage: 'progress', percent: 10, message: 'Listening' },
			{ stage: 'progress', percent: 20, message: 'Listening' },
			{ stage: 'item', op: 'add', data: { id: 'n12', name: 'Door sensor' } },
			{ stage: 'item', op: 'update', data: { id: 'n12', status: 'secure' } },
			{ stage: 'complete', data: { added: 1 } }
		);
		expect(r.state).toBe('done');
		expect(r.lines.map((l) => l.text)).toEqual(['Listening', 'Found Door sensor.', 'Done.']);
		expect(r.items).toEqual({ n12: { id: 'n12', name: 'Door sensor', status: 'secure' } });
	});

	test('a question, in either shape homeCore’s plugins send', () => {
		const flat = after({
			stage: 'awaiting_user',
			prompt: 'Proceed?',
			response_schema: { proceed: { type: 'boolean', required: true } }
		});
		expect(flat.state).toBe('waiting');
		expect(flat.prompt?.fields.map((f) => f.kind)).toEqual(['bool']);
		expect(flat.prompt?.required).toEqual(['proceed']);
		const schema = after({
			stage: 'awaiting_user',
			prompt: 'Which bridge?',
			response_schema: {
				properties: { bridge: { type: 'string', enum: ['a', 'b'] } },
				required: ['bridge']
			}
		});
		expect(schema.prompt?.required).toEqual(['bridge']);
		const advisory = after({ stage: 'awaiting_user', prompt: 'Press the link button.' });
		expect(advisory.state).toBe('running');
		expect(advisory.prompt).toBeUndefined();
	});

	test('how it can end badly', () => {
		expect(
			after(
				{ stage: 'warning', message: 'retrying' },
				{ stage: 'error', message: 'gave up' }
			).lines.map((l) => [l.text, l.tone])
		).toEqual([
			['retrying', 'warn'],
			['gave up', 'bad']
		]);
		expect(
			after({ stage: 'error', message: 'x', data: { reason: 'plugin_offline' } }).lines[0]!.text
		).toBe('The plugin stopped answering.');
		expect(after({ stage: 'timeout' }).state).toBe('timed out');
		expect(after({ stage: 'canceled' }).state).toBe('canceled');
	});
});

test('what an action hands back reads as lines', () => {
	expect(
		resultLines({
			host: '10.0.0.5',
			devices_removed: 3,
			raw_response: { ok: true },
			ids: ['a', 'b']
		})
	).toEqual([
		{ label: 'Host', value: '10.0.0.5' },
		{ label: 'Devices removed', value: '3' },
		{ label: 'Raw response', value: 'ok: yes' },
		{ label: 'Ids', value: 'a, b' }
	]);
	expect(resultLines(undefined)).toEqual([]);
	// WLED's per-device lists, counted rather than dumped.
	expect(
		resultLines({
			devices: {
				wled_desk: { host: '10.0.10.74', effects: ['Solid', 'Blink'], palettes: ['Default'] }
			}
		})
	).toEqual([{ label: 'Devices', value: 'wled_desk: host 10.0.10.74, 2 effects, 1 palette' }]);
});

describe('what a plugin says about its fields', () => {
	it('names choices as the plugin does, keeps its help, and hides passwords', () => {
		const [bridge, server, password] = paramFields({
			id: 'x',
			label: 'x',
			params: {
				bridge_id: {
					type: 'string',
					title: 'Bridge',
					description: 'Pick which bridge to pair against',
					enum: ['001788fffe1', '001788fffe2'],
					'x-options': [
						{ value: '001788fffe1', label: 'Hue Bridge (10.0.10.20)' },
						{ value: '001788fffe2', label: 'Upstairs (10.0.10.21)' }
					]
				},
				server: { type: 'string', description: 'Leave blank to auto-detect (recommended)' },
				password: { type: 'string' }
			}
		});
		expect(bridge).toMatchObject({
			kind: 'choice',
			help: 'Pick which bridge to pair against',
			options: [
				{ value: '001788fffe1', label: 'Hue Bridge (10.0.10.20)' },
				{ value: '001788fffe2', label: 'Upstairs (10.0.10.21)' }
			]
		});
		expect(server).toMatchObject({ help: 'Leave blank to auto-detect (recommended)' });
		expect(password).toMatchObject({ kind: 'text', secret: true });
	});
});
