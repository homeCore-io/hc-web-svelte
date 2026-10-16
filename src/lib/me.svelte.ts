/**
 * Who is signed in, as homeCore says (`/ui/me`).
 */
export interface Me {
	id?: string;
	username: string;
	role: string;
	scopes: string[];
}

class Session {
	me = $state<Me | null>(null);
	/** Whether we have asked yet. */
	known = $state(false);

	async load(): Promise<Me | null> {
		try {
			const res = await fetch('/ui/me');
			this.me = res.ok ? ((await res.json()) as Me) : null;
		} catch {
			this.me = null;
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

	get isAdmin(): boolean {
		return this.me?.role === 'admin';
	}
}

export const session = new Session();
