import { describe, expect, test } from 'vitest';
import { installLabel, installedText, isInstalledVersion, listed } from './catalog.js';
import type { PluginRecord } from './plugins.js';

const rec = (version?: string): PluginRecord =>
	({
		plugin_id: 'plugin.caseta',
		status: 'stopped',
		enabled: false,
		managed: true,
		restart_count: 0,
		version
	}) as PluginRecord;

describe('an installed plugin in the Catalog', () => {
	test('a version that isn’t known is said so, not left blank', () => {
		expect(installedText(rec('0.1.14'))).toBe('Installed · 0.1.14');
		expect(installedText(rec())).toBe('Installed, version unknown');
	});
	test('an update only over a known, older version', () => {
		expect(installLabel('Caséta', '0.1.15')).toBe('Install Caséta');
		expect(installLabel('Caséta', '0.1.15', rec('0.1.14'))).toBe('Update to 0.1.15');
		expect(installLabel('Caséta', '0.1.13', rec('0.1.14'))).toBe('Install 0.1.13');
		expect(installLabel('Caséta', '0.1.15', rec())).toBe('Install 0.1.15');
		expect(installLabel('Caséta', '0.1.14', rec('0.1.14'))).toBe('Reinstall 0.1.14');
	});
});

describe('isInstalledVersion', () => {
	test('is true only for the known installed version', () => {
		expect(isInstalledVersion('0.1.14', rec('0.1.14'))).toBe(true);
		expect(isInstalledVersion('0.1.15', rec('0.1.14'))).toBe(false);
		expect(isInstalledVersion('0.1.14', rec())).toBe(false);
		expect(isInstalledVersion('0.1.14')).toBe(false);
	});
});

describe('listed', () => {
	const registry = [{ id: 'plugin.hue' }, { id: 'plugin.isy' }];
	const have = [{ plugin_id: 'plugin.hue' } as PluginRecord];
	test('leaves out installed plugins unless asked', () => {
		expect(listed(registry, have, false).map((p) => p.id)).toEqual(['plugin.isy']);
		expect(listed(registry, have, true).map((p) => p.id)).toEqual(['plugin.hue', 'plugin.isy']);
	});
});
