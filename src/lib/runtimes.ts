/**
 * Plugin runtimes, for the Runtimes page: how one is doing, what to call a new
 * one, and copying a key on a page that may not be served over https.
 */
import type { Runtime } from './pluginAdmin.js';

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
export const kindName = (kind: string) =>
	kind === 'python' ? 'Python' : kind.charAt(0).toUpperCase() + kind.slice(1);

type Artifact = { arch: string; runtime?: string; abi?: string };

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
		artifacts.some((a) => a.runtime === r.kind && a.abi === r.abi && a.arch === r.arch)
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
