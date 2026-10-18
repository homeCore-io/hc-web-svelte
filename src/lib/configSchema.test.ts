import { describe, expect, it } from 'vitest';
import { descriptorFromSchema, humanize } from './configSchema.js';
import { changes, fieldsOf, valuesOf, writes, type Field } from './descriptor.js';
import { runtimesToChoose } from './pluginAdmin.js';
import thermostat from './fixtures/thermostat-schema.json';

const field = (d: ReturnType<typeof descriptorFromSchema>, key: string) =>
	d ? fieldsOf(d).get(key) : undefined;

describe('a form from a plugin’s schema', () => {
	it('names settings as people read them', () => {
		expect(humanize('broker_port')).toBe('Broker port');
		expect(humanize('maxSizeMb')).toBe('Max size mb');
	});

	it('makes a section per table, following $refs, homeCore’s own last and read-only', () => {
		const d = descriptorFromSchema(thermostat, 'plugin.thermostat')!;
		expect(d.sections.map((s) => s.id)).toEqual(['logging', 'thermostat', 'homecore']);
		const own = d.sections.at(-1)!;
		expect(own.title).toBe('Connection to homeCore');
		expect(own.fields.every((f) => f.read_only)).toBe(true);
		expect(field(d, 'homecore.broker_port')).toMatchObject({ kind: 'port', default: 1883 });
		expect(field(d, 'homecore.password')).toMatchObject({ kind: 'secret', secret: true });
	});

	it('types each setting from the schema: toggles, numbers with bounds, choices', () => {
		const d = descriptorFromSchema(thermostat)!;
		expect(field(d, 'logging.compress')).toMatchObject({ kind: 'toggle', default: true });
		expect(field(d, 'logging.max_size_mb')).toMatchObject({ kind: 'int', min: 0, default: 100 });
		expect(field(d, 'logging.rotation')).toMatchObject({
			kind: 'enum',
			default: 'daily',
			options: ['daily', 'hourly', 'weekly', 'never'].map((v) => ({ value: v, label: v }))
		});
		// Only the first paragraph of a doc comment.
		expect(field(d, 'logging.level')?.help).toBe(
			'Stderr log level when `RUST_LOG` is not set. Accepts any `tracing` filter directive, e.g. `"debug"` or `"hc_hue=debug,rumqttc=warn"`.'
		);
	});

	it('shows [[rows]] whose rows hold more than plain values, but leaves changing them to the file', () => {
		const d = descriptorFromSchema(thermostat)!;
		const rows = field(d, 'thermostat')!;
		expect(rows.kind).toBe('table');
		expect(rows.read_only).toBe(true); // actuator_on_cmd is any value at all
		expect((rows.item as Field[]).every((c) => c.read_only)).toBe(true);
		expect(rows.key_by).toBe('name');
		expect((rows.item as Field[]).map((c) => c.key)).toContain('hysteresis');
	});

	it('writes a change into its table, the way a plugin’s own form does', () => {
		const d = descriptorFromSchema(thermostat)!;
		const config = { logging: { level: 'info' }, homecore: { plugin_id: 'plugin.thermostat' } };
		const was = valuesOf(d, config);
		const now = { ...was, 'logging.level': 'debug', 'logging.max_size_mb': 5 };
		expect(writes(changes(d, was, now)).patch).toEqual({
			logging: { level: 'debug', max_size_mb: 5 }
		});
	});

	it('shows top-level settings read-only — a patch can only write into a table', () => {
		const d = descriptorFromSchema({
			type: 'object',
			required: ['site'],
			properties: {
				site: { type: 'string' },
				poll_secs: { type: ['integer', 'null'], minimum: 5 },
				api: {
					type: 'object',
					properties: {
						url: { type: 'string', format: 'uri' },
						api_key: { anyOf: [{ type: 'string' }, { type: 'null' }] },
						mode: {
							oneOf: [
								{ const: 'cloud', description: 'Through the vendor' },
								{ const: 'local', title: 'On the network' }
							]
						},
						extra: { type: 'object', additionalProperties: true },
						tags: { type: 'array', items: { type: 'string' } }
					}
				}
			}
		})!;
		expect(d.sections.map((s) => s.id)).toEqual(['_general', 'api']);
		expect(field(d, 'site')).toMatchObject({ kind: 'text', required: true, read_only: true });
		expect(field(d, 'poll_secs')).toMatchObject({ kind: 'int', min: 5, read_only: true });
		expect(field(d, 'poll_secs')?.required).toBeUndefined();
		expect(field(d, 'api.url')?.kind).toBe('url');
		expect(field(d, 'api.api_key')).toMatchObject({ kind: 'secret' });
		expect(field(d, 'api.mode')?.options).toEqual([
			{ value: 'cloud', label: 'Through the vendor' },
			{ value: 'local', label: 'On the network' }
		]);
		expect(field(d, 'api.tags')).toMatchObject({ kind: 'list', item: 'text' });
		// `extra` can't be typed: it's said, not dropped silently.
		expect(d.sections[0]!.fields.at(-1)).toMatchObject({ kind: 'note' });
	});

	it('gives up on what isn’t a table of settings', () => {
		expect(descriptorFromSchema(null)).toBeNull();
		expect(descriptorFromSchema({ type: 'string' })).toBeNull();
		expect(descriptorFromSchema({ type: 'object', properties: { x: {} } })).toBeNull();
	});
});

describe('choosing a runtime when homeCore asks', () => {
	it('reads the runtimes from homeCore’s 409, and nothing from other refusals', () => {
		expect(
			runtimesToChoose({ ok: false, status: 409, error: 'choose', body: { runtimes: ['a', 'b'] } })
		).toEqual(['a', 'b']);
		expect(runtimesToChoose({ ok: false, status: 422, error: 'no', body: {} })).toEqual([]);
		expect(runtimesToChoose({ ok: true, data: {} })).toEqual([]);
	});
});
