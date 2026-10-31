import { describe, expect, it } from 'vitest';
import {
	changes,
	describe as say,
	fieldsOf,
	getter,
	holds,
	linkTo,
	parse,
	problem,
	problems,
	sectionShown,
	fieldShown,
	holdsValue,
	valuesOf,
	writes,
	json,
	type Descriptor,
	type Field
} from './descriptor.js';
import system from './fixtures/system-descriptor.json' with { type: 'json' };

const sys = system as unknown as Descriptor;
const file = {
	server: { host: '0.0.0.0', port: 8080 },
	influx: { enabled: false, bucket: 'homecore' },
	plugin_runtimes: { enabled: true, mode: 'open' },
	broker: { clients: [{ id: 'a', password: 'p', allow_pub: ['x/#'] }] }
};

describe('conditions', () => {
	const get = (k: string) => ({ a: true, b: 'open', n: 5, l: [] as unknown[] })[k];
	it('reads every shape core sends', () => {
		expect(holds({ field: 'a', truthy: true }, get)).toBe(true);
		expect(holds({ field: 'l', truthy: false }, get)).toBe(true);
		expect(holds({ field: 'missing', truthy: false }, get)).toBe(true);
		expect(holds({ field: 'b', eq: 'open' }, get)).toBe(true);
		expect(holds({ field: 'b', ne: 'open' }, get)).toBe(false);
		expect(holds({ field: 'b', in: ['token', 'open'] }, get)).toBe(true);
		expect(holds({ field: 'n', gt: 4 }, get)).toBe(true);
		expect(holds({ field: 'n', lt: 4 }, get)).toBe(false);
		expect(
			holds(
				{
					all: [
						{ field: 'a', truthy: true },
						{ field: 'b', eq: 'x' }
					]
				},
				get
			)
		).toBe(false);
		expect(
			holds(
				{
					any: [
						{ field: 'a', truthy: true },
						{ field: 'b', eq: 'x' }
					]
				},
				get
			)
		).toBe(true);
		expect(holds({ not: { field: 'a', truthy: true } }, get)).toBe(false);
		expect(holds(undefined, get)).toBe(true);
	});

	it('a default counts: runtimes are on unless the file says off', () => {
		const draft = valuesOf(sys, {});
		const get = getter(sys, draft);
		const rt = sys.sections.find((s) => s.id === 'plugin_runtimes')!;
		const shown = rt.fields.filter((f) => fieldShown(f, get)).map((f) => f.key);
		// enabled defaults true and mode defaults open, so the open-mode fields show.
		expect(shown).toContain('plugin_runtimes.pending_ttl_mins');
		draft['plugin_runtimes.mode'] = 'token';
		expect(rt.fields.filter((f) => fieldShown(f, get)).map((f) => f.key)).not.toContain(
			'plugin_runtimes.pending_ttl_mins'
		);
		expect(sectionShown(rt, get)).toBe(true);
	});
});

describe('values', () => {
	it('reads dotted keys, including ones from another table', () => {
		const v = valuesOf(sys, { ...file, rules: { dir: 'rules' } });
		expect(v['server.port']).toBe(8080);
		expect(v['rules.dir']).toBe('rules');
		expect(v['location.latitude']).toBeUndefined();
		expect(fieldsOf(sys).get('broker.clients')?.kind).toBe('table');
	});

	it('parses typed text by kind', () => {
		const port = { kind: 'port' } as Field;
		expect(parse(port, ' 8081 ')).toEqual({ value: 8081 });
		expect(parse(port, '80.5')).toHaveProperty('error');
		expect(parse(port, '')).toEqual({ value: undefined });
		expect(parse({ kind: 'number' } as Field, '-33.8')).toEqual({ value: -33.8 });
		expect(parse({ kind: 'int' } as Field, 'ten')).toHaveProperty('error');
		expect(parse({ kind: 'secret' } as Field, ' a b ')).toEqual({ value: ' a b ' });
	});

	it('finds what is wrong', () => {
		expect(problem({ kind: 'port' } as Field, 70000)).toMatch(/1 to 65535/);
		expect(problem({ kind: 'int', min: 1, unit: 'days' } as Field, 0)).toBe('At least 1 days.');
		expect(problem({ kind: 'url' } as Field, 'influx:8086')).toMatch(/http/);
		expect(problem({ kind: 'url' } as Field, 'http://10.0.0.2:8086')).toBeNull();
		expect(problem({ kind: 'host' } as Field, 'my host')).toMatch(/spaces/);
		expect(problem({ kind: 'text', required: true } as Field, undefined)).toMatch(/needs/);
		expect(problem({ kind: 'text', required: true, default: 'x' } as Field, undefined)).toBeNull();
		expect(problem({ kind: 'list', item: 'int' } as Field, [1, 2.5])).toMatch(/^2.5: /);
	});

	it('only checks fields that are shown', () => {
		const draft = valuesOf(sys, file);
		draft['influx.url'] = 'nope';
		expect(problems(sys, draft)).toEqual({});
		draft['influx.enabled'] = true;
		expect(Object.keys(problems(sys, draft))).toEqual(['influx.url']);
	});

	it('says values as a person would', () => {
		const f = fieldsOf(sys);
		expect(say(f.get('server.port')!, undefined)).toBe('default (8080)');
		expect(say(f.get('influx.enabled')!, true)).toBe('on');
		expect(say(f.get('plugin_runtimes.mode')!, 'token')).toBe('Token only');
		expect(say(f.get('influx.token')!, 'abc')).toBe('a secret');
		expect(say(f.get('influx.flush_interval_secs')!, 10)).toBe('10 seconds');
	});
});

describe('writes', () => {
	it('keeps a number field a float, even when whole', () => {
		const original = valuesOf(sys, { battery: { threshold_pct: 20.0 } });
		const draft = { ...original, 'battery.threshold_pct': 15, 'server.port': 9000 };
		const body = { patch: writes(changes(sys, original, draft)).patch };
		expect(json(body)).toBe('{"patch":{"server":{"port":9000},"battery":{"threshold_pct":15.0}}}');
		draft['battery.threshold_pct'] = 15.5;
		expect(json({ patch: writes(changes(sys, original, draft)).patch })).toContain('15.5}');
	});

	it('patches each field into its own table, and tables go whole', () => {
		const original = valuesOf(sys, { ...file, rules: { dir: 'rules' } });
		const draft = { ...original, 'server.port': 8081, 'rules.dir': 'r2', 'broker.clients': [] };
		const cs = changes(sys, original, draft);
		expect(cs.map((c) => c.key)).toEqual(['server.port', 'broker.clients', 'rules.dir']);
		const w = writes(cs);
		expect(w.patch).toEqual({ server: { port: 8081 }, rules: { dir: 'r2' } });
		expect(w.tables).toEqual([{ section: 'broker.clients', items: [] }]);
		expect(w.cannot).toEqual([]);
	});

	it('clearing writes the default, or is refused where there is none', () => {
		const original = valuesOf(sys, { ...file, location: { latitude: 1 } });
		const draft = { ...original, 'server.port': undefined, 'location.latitude': undefined };
		const w = writes(changes(sys, original, draft));
		expect(w.patch).toEqual({ server: { port: 8080 } });
		expect(w.cannot.map((c) => c.key)).toEqual(['location.latitude']);
	});
});

it('links fill in the host and config values', () => {
	expect(
		linkTo('http://{client_host}:{api.port}/', 'hc.lan', (k) => (k === 'api.port' ? 9 : 0))
	).toBe('http://hc.lan:9/');
});

describe('the file, read over a shoulder', async () => {
	const { maskSecrets } = await import('./config.js');
	it('hides secret values and leaves comments and the rest', () => {
		const raw = [
			'[influx]',
			'token = "abc"  # comment',
			'bucket = "homecore"',
			'# password = "x"',
			'[[notify.channels]]',
			'bot_token="1:2"',
			'user_key = "u"'
		].join('\n');
		expect(maskSecrets(raw, sys).split('\n')).toEqual([
			'[influx]',
			'token = "••••••••"',
			'bucket = "homecore"',
			'# password = "x"',
			'[[notify.channels]]',
			'bot_token="••••••••"',
			'user_key = "••••••••"'
		]);
	});
});

describe('a name → value table (logging.targets)', () => {
	const levels = ['error', 'warn', 'info', 'debug', 'trace'].map((l) => ({ value: l, label: l }));
	const d: Descriptor = {
		sections: [
			{
				id: 'logging',
				title: 'Logging',
				fields: [{ kind: 'map', key: 'logging.targets', item: 'enum', options: levels }]
			}
		]
	};
	const field = d.sections[0]!.fields[0]!;

	it('is read from the file like any setting', () => {
		expect(valuesOf(d, { logging: { targets: { hc_core: 'debug' } } })).toEqual({
			'logging.targets': { hc_core: 'debug' }
		});
	});

	it('is written as a patch on the table: each name set, each one taken out as null', () => {
		const was = { 'logging.targets': { hc_core: 'debug', rumqttd: 'warn' } };
		const now = { 'logging.targets': { hc_core: 'trace', hc_api: 'info' } };
		const w = writes(changes(d, was, now));
		expect(w.patch).toEqual({
			'logging.targets': { hc_core: 'trace', hc_api: 'info', rumqttd: null }
		});
		expect(w.cannot).toEqual([]);
	});

	it('says what’s wrong with a name or a level', () => {
		expect(problem(field, { hc_core: 'debug', 'hc_core::engine': 'trace' })).toBeNull();
		expect(problem(field, { 'hc core': 'debug' })).toMatch(/no spaces/);
		expect(problem(field, { hc_core: 'loud' })).toMatch(/isn’t one of/);
		expect(say(field, { a: 'info', b: 'warn' })).toBe('2 entries');
	});
});

describe('this app’s own field kinds (G-b)', () => {
	const f = {
		kind: 'sensor',
		key: 'temperature',
		options: [
			{ value: 'auto', label: 'Average of the room’s sensors' },
			{ value: 'none', label: 'No temperature' }
		]
	};
	it('a sensor holds a value and says what it is', () => {
		expect(holdsValue(f)).toBe(true);
		expect(say(f, 'auto')).toBe('Average of the room’s sensors');
		expect(say(f, ['a'])).toBe('one sensor');
		expect(say(f, ['a', 'b'])).toBe('an average of 2 sensors');
	});
	it('an ordered list is a list: what changed is its order too', () => {
		const order = { kind: 'list', render: 'order', key: 'numbers', options: [] };
		const d = { sections: [{ id: 's', title: 'S', fields: [order] }] };
		expect(changes(d, { numbers: ['a', 'b'] }, { numbers: ['b', 'a'] })).toHaveLength(1);
	});
});
