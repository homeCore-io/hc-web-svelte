import { describe, expect, it } from 'vitest';
import {
	homecoreUrlFrom,
	nextName,
	QUIET_AFTER_MS,
	runtimeNeeds,
	runtimeState
} from './runtimes.js';

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

describe('what a plugin needs', () => {
	const py = { arch: 'x86_64', runtime: 'python', abi: 'cp312-manylinux_2_28' };
	const rt = (over: Partial<import('./pluginAdmin.js').Runtime>) => ({
		runtime_id: 'rt-1',
		name: 'Python runtime 1',
		kind: 'python',
		abi: 'cp312-manylinux_2_28',
		plugin_id: 'plugin.python-rt1',
		homecore_url: 'http://h',
		created_at: '2026-11-15T00:00:00Z',
		...over
	});

	it('runs here when there is a native build', () => {
		expect(runtimeNeeds([{ arch: 'x86_64' }, py], []).state).toBe('here');
	});
	it('says a runtime is needed when none is added', () => {
		expect(runtimeNeeds([py], [])).toEqual({ state: 'none', kind: 'python' });
	});
	it('waits for an added runtime that has not connected', () => {
		expect(runtimeNeeds([py], [rt({})]).state).toBe('waiting');
	});
	it('names the runtimes that can run it', () => {
		const n = runtimeNeeds([py], [rt({ arch: 'x86_64' })]);
		expect(n.state === 'ready' && n.on.map((r) => r.name)).toEqual(['Python runtime 1']);
	});
	it('says what does not match', () => {
		const n = runtimeNeeds([py], [rt({ arch: 'aarch64' })]);
		expect(n).toEqual({ state: 'mismatch', kind: 'python', want: 'x86_64', have: 'aarch64' });
	});
});

describe('a full runtime', () => {
	const py = { arch: 'x86_64', runtime: 'python', abi: 'cp312-manylinux_2_28' };
	const pi = {
		runtime_id: 'rt-pi',
		name: 'Pi',
		kind: 'python',
		abi: 'cp312-manylinux_2_28',
		plugin_id: 'plugin.python-rtpi',
		homecore_url: 'http://h',
		created_at: '2026-11-15T00:00:00Z',
		arch: 'x86_64',
		max_plugins: 2
	};
	const held = (n: number, has = false) => ({ count: () => n, has: () => has });

	it('takes no new plugin', () => {
		expect(runtimeNeeds([py], [pi], held(2)).state).toBe('full');
		expect(runtimeNeeds([py], [pi], held(1)).state).toBe('ready');
	});
	it('still takes an update to one it holds', () => {
		expect(runtimeNeeds([py], [pi], held(2, true)).state).toBe('ready');
	});
	it('has no ceiling without a limit', () => {
		expect(runtimeNeeds([py], [{ ...pi, max_plugins: undefined }], held(9)).state).toBe('ready');
	});
});
