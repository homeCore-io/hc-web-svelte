/**
 * Settings' changes to house facts, which are homeCore's (M1): room names,
 * new rooms, a device's name and room. homeCore announces each one (H2), so
 * every open screen — this one included — updates from its event stream.
 *
 * Each answers `null` when done, or what went wrong, in words for a person.
 */
import type { AlertRule } from './alerts.js';

async function send(method: string, path: string, body: unknown): Promise<string | null> {
	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch {
		return 'homeCore is not answering.';
	}
	if (res.ok) return null;
	if (res.status === 401 || res.status === 403) return "You aren't allowed to change this.";
	const said = (await res.json().catch(() => ({}))) as { error?: unknown };
	return typeof said.error === 'string' ? said.error : `homeCore said no (${res.status}).`;
}

const room = (id: string) => `/areas/${encodeURIComponent(id)}`;
const device = (id: string) => `/devices/${encodeURIComponent(id)}`;

/** A room with the name as typed (D10); an existing room by that name is reused. */
export const createRoom = (name: string) => send('POST', '/areas', { name });

/** Rename a room; its id, devices and everything keyed by it stay (H1). */
export async function renameRoom(id: string, name: string): Promise<string | null> {
	const err = await send('PATCH', room(id), { name });
	return err !== null && /already/i.test(err) ? 'Another room already has that name.' : err;
}

export const renameDevice = (id: string, name: string) => send('PATCH', device(id), { name });

/** Put a device in a room by its name as typed, or in none. */
export const moveDevice = (id: string, roomName: string | null) =>
	send('PATCH', device(id), { area: roomName });

// ---- alert time rules (C9, H4) ----

export async function alertRules(): Promise<AlertRule[] | null> {
	try {
		const res = await fetch('/api/v1/alert-rules');
		return res.ok ? ((await res.json()) as AlertRule[]) : null;
	} catch {
		return null;
	}
}

export const createAlertRule = (rule: Omit<AlertRule, 'id'>) => send('POST', '/alert-rules', rule);
export const saveAlertRule = (rule: AlertRule) =>
	send('PUT', `/alert-rules/${encodeURIComponent(rule.id)}`, rule);
export const deleteAlertRule = (id: string) =>
	send('DELETE', `/alert-rules/${encodeURIComponent(id)}`, {});

/** Delete a room; its devices are left in no room. */
export const deleteRoom = (id: string) => send('DELETE', room(id), {});

/**
 * Merge a room into another (H1): its devices move, its names become the
 * other's aliases (so a plugin still saying the old name lands there), and
 * the UI server points what it keeps about the room at the other one.
 */
export async function mergeRoom(id: string, into: string): Promise<string | null> {
	const err = await send('POST', `${room(id)}/merge`, { into });
	if (err) return err;
	try {
		const res = await fetch('/ui/rooms/merged', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ from: id, into })
		});
		if (res.ok) return null;
		const said = (await res.json().catch(() => ({}))) as { error?: string };
		return `Merged, but pages still mention the old room: ${said.error ?? res.status}`;
	} catch {
		return 'Merged, but pages still mention the old room: the UI server is not answering.';
	}
}
