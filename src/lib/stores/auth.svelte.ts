import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { TOKEN_STORAGE_KEY } from '$lib/config';
import type { HomeCoreUser } from '$lib/models/auth';
import * as authApi from '$lib/api/auth';

class AuthState {
	token = $state<string | null>(null);
	user = $state<HomeCoreUser | null>(null);
	ready = $state(false);
	loggingIn = $state(false);
	error = $state<string | null>(null);

	async init() {
		if (!browser || this.ready) return;
		this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
		if (!this.token) {
			this.ready = true;
			return;
		}

		try {
			this.user = await authApi.getCurrentUser();
		} catch {
			this.clear();
		} finally {
			this.ready = true;
		}
	}

	async login(username: string, password: string) {
		this.loggingIn = true;
		this.error = null;
		try {
			const token = await authApi.login(username, password);
			this.token = token;
			localStorage.setItem(TOKEN_STORAGE_KEY, token);
			this.user = await authApi.getCurrentUser();
			await goto('/dashboard');
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Login failed';
			throw error;
		} finally {
			this.loggingIn = false;
		}
	}

	async logout() {
		this.clear();
		await goto('/login');
	}

	clear() {
		this.token = null;
		this.user = null;
		this.error = null;
		if (browser) {
			localStorage.removeItem(TOKEN_STORAGE_KEY);
		}
	}

	get isAuthenticated() {
		return !!this.token && !!this.user;
	}
}

export const authState = new AuthState();
