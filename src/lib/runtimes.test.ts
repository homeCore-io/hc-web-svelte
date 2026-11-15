import { describe, expect, it } from 'vitest';
import { homecoreUrlFrom, nextName, QUIET_AFTER_MS, runtimeState } from './runtimes.js';

describe('plugin runtimes', () => {
	const now = Date.parse('2026-11-15T12:00:00Z');

	it('says whether a runtime has connected, and whether it still is', () => {
		expect(runtimeState({}, now)).toBe('waiting');
		expect(runtimeState({ last_seen_at: '2026-11-15T11:59:40Z' }, now)).toBe('connected');
		const old = new Date(now - QUIET_AFTER_MS - 1000).toISOString();
		expect(runtimeState({ last_seen_at: old }, now)).toBe('quiet');
	});

	it('numbers a new runtime after the ones already added', () => {
		expect(nextName([])).toBe('Python runtime 1');
		expect(nextName([{ name: 'Python runtime 1' }, { name: 'Garage box' }])).toBe(
			'Python runtime 2'
		);
		expect(nextName([{ name: 'Python runtime 4' }, { name: 'Python runtime 2' }])).toBe(
			'Python runtime 5'
		);
	});

	it('fills in the address this page came from', () => {
		expect(homecoreUrlFrom({ protocol: 'http:', host: 'homecore.local:3000' })).toBe(
			'http://homecore.local:3000'
		);
	});
});
