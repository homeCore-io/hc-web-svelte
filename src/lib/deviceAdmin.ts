/**
 * An admin's changes to devices (A1): several at once, and deleting. homeCore
 * announces each (device_metadata_changed, device_removed), so every open
 * screen follows from its event stream.
 *
 * Each answers null when done, or what went wrong, in words for a person.
 */
async function call(method: string, path: string, body?: unknown): Promise<string | null> {
	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		return 'homeCore is not answering.';
	}
	if (res.ok) return null;
	if (res.status === 401 || res.status === 403) return "You aren't allowed to change this.";
	const said = (await res.json().catch(() => ({}))) as { error?: unknown };
	return typeof said.error === 'string' ? said.error : `homeCore said no (${res.status}).`;
}

const one = (id: string) => `/devices/${encodeURIComponent(id)}`;

/** Put devices in a room by its name (made if new), or in none. One call. */
export const moveDevices = (ids: string[], roomName: string | null) =>
	call('PATCH', '/devices', { ids, area: roomName });

export interface Deleted {
	error: string | null;
	/** Rules homeCore turned off because they named a deleted device. */
	rules: string[];
}

/**
 * Deletes devices. homeCore turns off every rule that named one (its
 * reference becomes `DELETED:<id>`) and says which.
 */
export async function deleteDevices(ids: string[]): Promise<Deleted> {
	// A mode is homeCore config (modes.toml): deleting only its device would
	// leave it to come back. Night and Day can't go at all.
	const modes = ids.filter((id) => id.startsWith('mode_'));
	if (modes.some((id) => id === 'mode_night' || id === 'mode_day'))
		return { error: 'Night Mode and Day Mode are built in and can’t be deleted.', rules: [] };
	for (const id of modes) {
		const err = await call('DELETE', `/modes/${encodeURIComponent(id)}`);
		if (err) return { error: err, rules: [] };
	}
	ids = ids.filter((id) => !id.startsWith('mode_'));
	if (ids.length === 0) return { error: null, rules: [] };
	try {
		const res = await fetch('/api/v1/devices', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ids })
		});
		const body = (await res.json().catch(() => ({}))) as {
			affected_rules?: string[];
			error?: string;
		};
		if (!res.ok)
			return {
				error:
					res.status === 401 || res.status === 403
						? "You aren't allowed to change this."
						: (body.error ?? `homeCore said no (${res.status}).`),
				rules: []
			};
		return { error: null, rules: body.affected_rules ?? [] };
	} catch {
		return { error: 'homeCore is not answering.', rules: [] };
	}
}

/** Changes one device: its name (a person's override), room, or name in rules. */
export const patchDevice = (id: string, body: Record<string, unknown>) =>
	call('PATCH', one(id), body);

/** Any call to homeCore: null when done, else what went wrong. */
export { call as deviceCall };
