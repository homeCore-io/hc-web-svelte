import { describe, expect, it } from 'vitest';
import {
	homecoreUrlFrom,
	installsAtOnce,
	nextName,
	QUIET_AFTER_MS,
	runtimePage,
	runtimeNeeds,
	platformOf,
	seriesName,
	interpreterName,
	kindName,
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

describe('runtimePage', () => {
	it('uses the address the runtime was heard from', () => {
		expect(runtimePage({ source_ip: '10.0.0.7', page_port: 8790 }, 'hc.local')).toEqual({
			href: 'http://10.0.0.7:8790/',
			label: '10.0.0.7:8790'
		});
	});
	it("uses homeCore's host for a runtime beside it", () => {
		for (const ip of ['127.0.0.1', '::1', '172.17.0.3', '::ffff:172.18.0.2']) {
			expect(runtimePage({ source_ip: ip, page_port: 8790 }, 'hc.local')?.label).toBe(
				'hc.local:8790'
			);
		}
	});
	it('prefers the address the operator set', () => {
		expect(
			runtimePage(
				{ source_ip: '172.17.0.3', page_port: 8790, page_url: 'https://rt.lan:9000' },
				'x'
			)
		).toEqual({ href: 'https://rt.lan:9000/', label: 'rt.lan:9000' });
	});
	it('is null when the runtime does not say', () => {
		expect(runtimePage({ source_ip: '10.0.0.7' }, 'hc.local')).toBeNull();
		expect(runtimePage({ page_port: 8790 }, 'hc.local')).toBeNull();
	});
	it('brackets an IPv6 address', () => {
		expect(runtimePage({ source_ip: 'fd00::5', page_port: 8790 }, 'x')?.label).toBe(
			'[fd00::5]:8790'
		);
	});
});

describe('installsAtOnce', () => {
	it('needs a runtime host that takes check_in and a homeCore that sends it', () => {
		expect(installsAtOnce({ host_version: '0.2.2' }, true)).toBe(true);
		expect(installsAtOnce({ host_version: '0.10.0' }, true)).toBe(true);
		expect(installsAtOnce({ host_version: '0.2.1' }, true)).toBe(false);
		expect(installsAtOnce({ host_version: '0.2.2' }, false)).toBe(false);
		expect(installsAtOnce({}, true)).toBe(false);
		expect(installsAtOnce(undefined, true)).toBe(false);
	});
});

describe('interpreters', () => {
	const py = { arch: 'x86_64', runtime: 'python', abi: 'cp313-manylinux_2_28' };
	const rt = {
		runtime_id: 'rt1',
		name: 'Python runtime 1',
		kind: 'python',
		abi: 'manylinux_2_28',
		arch: 'x86_64',
		plugin_id: 'rt.rt1',
		homecore_url: 'http://hc:8080',
		created_at: '2026-11-19T00:00:00Z'
	};
	it('matches a package to a runtime by platform, whatever its Python', () => {
		expect(runtimeNeeds([py], [rt]).state).toBe('ready');
		expect(runtimeNeeds([{ ...py, abi: 'cp312-manylinux_2_28' }], [rt]).state).toBe('ready');
		expect(runtimeNeeds([{ ...py, abi: 'cp313-manylinux_2_17' }], [rt]).state).toBe('mismatch');
	});
	it('names them for people', () => {
		expect(platformOf('cp313-manylinux_2_28')).toBe('manylinux_2_28');
		expect(platformOf('manylinux_2_28')).toBe('manylinux_2_28');
		expect(seriesName('cp313')).toBe('3.13');
		expect(seriesName('cp310')).toBe('3.10');
		expect(platformOf('node24-glibc_2_28')).toBe('glibc_2_28');
		expect(seriesName('node24')).toBe('24');
		expect(kindName('node')).toBe('Node.js');
		expect(kindName('deno')).toBe('Deno');
		expect(nextName([{ name: 'Node.js runtime 1' }], 'node')).toBe('Node.js runtime 2');
		expect(interpreterName('python 3.13.18')).toBe('Python 3.13.18');
	});
});
