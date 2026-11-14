import { describe, expect, test } from 'vitest';
import { installLabel, installedText } from './catalog.js';
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
	});
});
