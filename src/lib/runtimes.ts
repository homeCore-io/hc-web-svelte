/**
 * Plugin runtimes, for the Runtimes page: how one is doing, what to call a new
 * one, and copying a key on a page that may not be served over https.
 */
import type { Runtime } from './pluginAdmin.js';
import { compareVersions } from './plugins.js';

/** A runtime checks in every 30 seconds; two missed is worth saying. */
export const QUIET_AFTER_MS = 90_000;

export type RuntimeState = 'waiting' | 'connected' | 'quiet';

/** Never heard from, heard from lately, or gone quiet. */
export function runtimeState(r: Pick<Runtime, 'last_seen_at'>, now: number): RuntimeState {
	if (!r.last_seen_at) return 'waiting';
	return now - Date.parse(r.last_seen_at) <= QUIET_AFTER_MS ? 'connected' : 'quiet';
}

/** "Python runtime 1", or the next number up from the ones already added. */
export function nextName(existing: Pick<Runtime, 'name'>[]): string {
	let n = 1;
	for (const r of existing) {
		const m = /^Python runtime (\d+)$/.exec(r.name ?? '');
		if (m) n = Math.max(n, Number(m[1]) + 1);
	}
	return `Python runtime ${n}`;
}

/**
 * Where a runtime should reach homeCore: the address this page came from. The
 * app passes `/api/v1` through to homeCore, so it works for a runtime too.
 */
export const homecoreUrlFrom = (loc: Pick<Location, 'protocol' | 'host'>) =>
	`${loc.protocol}//${loc.host}`;

/**
 * Copy text, also on a page served over plain http on the home network, where
 * the browser offers no clipboard API.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// fall through to the old way
	}
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	document.body.append(area);
	area.select();
	let ok = false;
	try {
		ok = document.execCommand('copy');
	} catch {
		ok = false;
	}
	area.remove();
	return ok;
}

/** The language names people know, for a runtime kind. */
/**
 * Where a runtime's own page is, to link to it: the address its operator set,
 * else the address homeCore heard it from and its page's port. An address
 * only this machine or Docker's bridge network can reach (loopback,
 * 172.16.0.0/12) means the runtime runs beside homeCore, so the page is on
 * the host the browser reaches homeCore at. Null when the runtime doesn't
 * say (its page is off, or it's older than host 0.2.1).
 */
export function runtimePage(
	r: Pick<Runtime, 'page_port' | 'page_url' | 'source_ip'>,
	browserHost: string
): { href: string; label: string } | null {
	if (r.page_url) {
		try {
			const u = new URL(r.page_url);
			return { href: u.href, label: u.host };
		} catch {
			return null;
		}
	}
	if (!r.page_port || !r.source_ip) return null;
	const ip = r.source_ip.replace(/^::ffff:/, '');
	const beside = ip === '::1' || /^127\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
	const host = beside ? browserHost : ip.includes(':') ? `[${ip}]` : ip;
	const label = `${host}:${r.page_port}`;
	return { href: `http://${label}/`, label };
}

export const kindName = (kind: string) =>
	kind === 'python' ? 'Python' : kind.charAt(0).toUpperCase() + kind.slice(1);

type Artifact = { arch: string; runtime?: string; abi?: string };

/**
 * The platform part of an abi tag. A package says `cp313-manylinux_2_28`: the
 * Python it was built for, then the platform. A runtime says only the platform,
 * since homeCore sends each plugin its own Python.
 */
export const platformOf = (abi = '') => abi.replace(/^cp\d+-/, '');

/** `cp313` as people say it: `3.13`. */
export const seriesName = (series: string) => {
	const m = /^cp(\d)(\d+)$/.exec(series);
	return m ? `${m[1]}.${m[2]}` : series;
};

/** `python 3.13.18`, as homeCore lists a placement's interpreter, for people. */
export const interpreterName = (i: string) => {
	const [kind = '', version] = i.split(' ');
	return version ? `${kindName(kind)} ${version}` : i;
};

/**
 * What a plugin version needs to run, told before anyone clicks Install.
 *
 * - `here`: homeCore runs it itself.
 * - `ready`: one or more connected runtimes can run it (`on` lists them).
 * - `none`: it needs a runtime of a kind nobody has added.
 * - `waiting`: one is added but has never connected, so where it runs is
 *   not known yet.
 * - `mismatch`: connected runtimes of that kind, none on a matching ABI and
 *   architecture.
 * - `full`: the ones that could run it all hold as many plugins as they may.
 */
export type Needs =
	| { state: 'here' }
	| { state: 'ready'; kind: string; on: Runtime[] }
	| { state: 'none'; kind: string }
	| { state: 'waiting'; kind: string; added: Runtime[] }
	| { state: 'mismatch'; kind: string; want: string; have: string }
	| { state: 'full'; kind: string; full: Runtime[] };

/** How many plugins each runtime holds, and whether this one is among them. */
export interface Held {
	count: (runtimeId: string) => number;
	has: (runtimeId: string) => boolean;
}

const isFull = (r: Runtime, held?: Held) =>
	!!held && !!r.max_plugins && !held.has(r.runtime_id) && held.count(r.runtime_id) >= r.max_plugins;

export function runtimeNeeds(artifacts: Artifact[], runtimes: Runtime[], held?: Held): Needs {
	if (artifacts.some((a) => !a.runtime || a.runtime === 'native')) return { state: 'here' };
	const kind = artifacts[0]?.runtime ?? 'python';
	const sameKind = runtimes.filter((r) => artifacts.some((a) => a.runtime === r.kind));
	if (!sameKind.length) return { state: 'none', kind };
	const on = sameKind.filter((r) =>
		artifacts.some(
			(a) => a.runtime === r.kind && platformOf(a.abi) === platformOf(r.abi) && a.arch === r.arch
		)
	);
	const room = on.filter((r) => !isFull(r, held));
	if (room.length) return { state: 'ready', kind, on: room };
	if (on.length) return { state: 'full', kind, full: on };
	const connected = sameKind.filter((r) => r.arch);
	if (!connected.length) return { state: 'waiting', kind, added: sameKind };
	return {
		state: 'mismatch',
		kind,
		want: [...new Set(artifacts.map((a) => a.arch))].join(' or '),
		have: [...new Set(connected.map((r) => r.arch))].join(' and ')
	};
}

/**
 * Whether homeCore tells this runtime about a change at once (core 0.1.114 and
 * runtime host 0.2.2), so it installs in seconds. Otherwise it waits for the
 * runtime's next check-in, up to half a minute.
 */
export const installsAtOnce = (r: Pick<Runtime, 'host_version'> | undefined, coreTells: boolean) =>
	coreTells && !!r?.host_version && compareVersions(r.host_version, '0.2.2') >= 0;
