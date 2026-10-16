/**
 * homecore.toml through homeCore's API (admin only): the descriptor that
 * says how to show it, the file and its parsed view, and the three ways to
 * write it — a patch of fields, a whole array of tables, or the raw file.
 */
import { json, type Descriptor, type Field } from './descriptor.js';

export interface Config {
	raw: string;
	parsed: Record<string, unknown>;
	path: string;
}

async function said(res: Response): Promise<string> {
	if (res.status === 401 || res.status === 403) return 'Only admins can change the configuration.';
	const body = (await res.json().catch(() => ({}))) as { error?: unknown };
	return typeof body.error === 'string' ? body.error : `homeCore said no (${res.status}).`;
}

/** The descriptor and the file, or what went wrong. */
export async function loadConfig(): Promise<{ descriptor: Descriptor; config: Config } | string> {
	try {
		const [d, c] = await Promise.all([
			fetch('/api/v1/system/config/descriptor'),
			fetch('/api/v1/system/config')
		]);
		if (!d.ok) return said(d);
		if (!c.ok) return said(c);
		const { descriptor } = (await d.json()) as { descriptor: Descriptor };
		return { descriptor, config: (await c.json()) as Config };
	} catch {
		return 'homeCore is not answering.';
	}
}

export type ConfigWrite =
	| { patch: Record<string, Record<string, unknown>> }
	| { array_of_tables: { section: string; items: unknown[] } }
	| { raw: string };

/** Writes homecore.toml; null when done. homeCore reads it again only when it restarts. */
export async function putConfig(body: ConfigWrite): Promise<string | null> {
	try {
		const res = await fetch('/api/v1/system/config', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: json(body)
		});
		return res.ok ? null : said(res);
	} catch {
		return 'homeCore is not answering.';
	}
}

/** Asks homeCore to restart; null when it has agreed to. */
export async function restart(): Promise<string | null> {
	try {
		const res = await fetch('/api/v1/system/restart', { method: 'POST' });
		return res.ok ? null : said(res);
	} catch {
		return 'homeCore is not answering.';
	}
}

const SECRETISH = /(password|passwd|token|secret|api_key|_key)$/i;

function secretNames(d: Descriptor): Set<string> {
	const names = new Set<string>();
	const visit = (f: Field) => {
		if ((f.secret || f.kind === 'secret') && f.key) names.add(f.key.split('.').pop()!);
		if (Array.isArray(f.item)) f.item.forEach(visit);
	};
	d.sections.forEach((s) => s.fields.forEach(visit));
	return names;
}

/** The file with secret values hidden, for reading over a shoulder. */
export function maskSecrets(raw: string, d: Descriptor): string {
	const names = secretNames(d);
	return raw
		.split('\n')
		.map((line) => {
			const m = /^(\s*)([A-Za-z0-9_.-]+)(\s*=\s*)(.+)$/.exec(line);
			if (!m) return line;
			const name = m[2]!.split('.').pop()!;
			if (!names.has(name) && !SECRETISH.test(name)) return line;
			return `${m[1]}${m[2]}${m[3]}"••••••••"`;
		})
		.join('\n');
}
