/**
 * Who is signed in, as homeCore says (`/ui/me`).
 */
export interface Me {
	id?: string;
	username: string;
	role: string;
	scopes: string[];
	/** `display` for a display's own session (H3). */
	kind?: 'display';
	/** Whether this person can unlock a display (H5). */
	has_pin?: boolean;
	/** A person unlocked on a display: which, and until when (ms). */
	unlocked_on?: { id: string; name: string; until?: number };
}

/** How long to wait before asking again, each time (ms). */
const RETRIES = [500, 1500, 3000];

class Session {
	me = $state<Me | null>(null);
	/** Whether we have asked yet. */
	known = $state(false);

	/**
	 * Asks who this is. A core that doesn't answer, or answers with a server
	 * error (busy, or restarting), is asked again a few times, a little later
	 * each time, before anyone is sent to sign in.
	 */
	async load(): Promise<Me | null> {
		for (let i = 0; ; i++) {
			try {
				const res = await fetch('/ui/me');
				if (res.status < 500 || i >= RETRIES.length) {
					this.me = res.ok ? ((await res.json()) as Me) : null;
					break;
				}
			} catch {
				if (i >= RETRIES.length) {
					this.me = null;
					break;
				}
			}
			await new Promise((r) => setTimeout(r, RETRIES[i]));
		}
		this.known = true;
		return this.me;
	}

	async signIn(username: string, password: string): Promise<string | null> {
		const res = await fetch('/ui/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ username, password })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			return typeof body.error === 'string' ? body.error : 'Sign-in failed.';
		}
		await this.load();
		return null;
	}

	async signOut(): Promise<void> {
		await fetch('/ui/auth/logout', { method: 'POST' });
		this.me = null;
	}

	/** May this session do `scope`? Judged by homeCore's scopes, never the role (S4). */
	can(scope: string): boolean {
		return this.me?.scopes.includes(scope) ?? false;
	}

	/** This screen is a display, showing only its pages (D7). */
	get isDisplay(): boolean {
		return this.me?.kind === 'display';
	}

	/**
	 * Whether homeCore treats this sign-in as an admin, the way it checks: an
	 * admin's own session carries `users:write` with its role, and a key is an
	 * admin's only when it was given that scope. A key made by an admin without
	 * it is refused everything admin-only, so the app doesn't offer those.
	 */
	get isAdmin(): boolean {
		return this.me?.role === 'admin' && this.can('users:write');
	}

	/** Whether they may tell devices what to do — not only look. */
	get mayUse(): boolean {
		return this.can('devices:command') || this.can('devices:write');
	}

	/** Whether they may run scenes. */
	get mayRunScenes(): boolean {
		return this.can('scenes:run') || this.can('scenes:write');
	}
}

export const session = new Session();
