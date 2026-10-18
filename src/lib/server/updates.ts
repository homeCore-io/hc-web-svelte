/**
 * Is there a newer homeCore, or a newer app? Asked of GitHub's releases by
 * the UI server — never by homeCore, which needs nothing from the internet —
 * at most every six hours, and not at all with HC_UPDATE_CHECK=off.
 */

import { newer, type Latest } from '#lib/updates.js';
export { newer };

const REPOS = { core: 'homeCore-io/homeCore', app: 'homeCore-io/hc-web-svelte' } as const;
const EVERY = 6 * 3600_000;

export type Updates = Partial<Record<keyof typeof REPOS, Latest>>;

let held: { at: number; data: Updates } | null = null;

export const updatesOff = () => /^(off|no|false|0)$/i.test(process.env.HC_UPDATE_CHECK ?? '');

export async function latest(get: typeof fetch = fetch, now = Date.now()): Promise<Updates> {
	if (held && now - held.at < EVERY) return held.data;
	const data: Updates = {};
	await Promise.all(
		(Object.keys(REPOS) as (keyof typeof REPOS)[]).map(async (k) => {
			try {
				const ask = (path: string) =>
					get(`https://api.github.com/repos/${REPOS[k]}/${path}`, {
						headers: { accept: 'application/vnd.github+json' },
						signal: AbortSignal.timeout(8000)
					});
				const res = await ask('releases/latest');
				if (res.ok) {
					const r = (await res.json()) as { tag_name?: string; html_url?: string };
					if (r.tag_name)
						data[k] = { version: r.tag_name.replace(/^v/, ''), url: r.html_url ?? '' };
					return;
				}
				// A repo that tags its releases without publishing them on GitHub.
				if (res.status !== 404) return;
				const tags = await ask('tags?per_page=100');
				if (!tags.ok) return;
				const top = ((await tags.json()) as { name: string }[])
					.map((t) => t.name)
					.filter((n) => /^v?\d+\.\d+\.\d+$/.test(n))
					.reduce<string | null>((a, b) => (a === null || newer(b, a) ? b : a), null);
				if (top)
					data[k] = {
						version: top.replace(/^v/, ''),
						url: `https://github.com/${REPOS[k]}/tree/${top}`
					};
			} catch {
				// No internet is fine: there's simply nothing to say.
			}
		})
	);
	// A failed ask is tried again sooner — in ten minutes, not six hours.
	held = { at: Object.keys(data).length ? now : now - EVERY + 600_000, data };
	return data;
}
