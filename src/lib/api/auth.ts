import type { HomeCoreUser } from '$lib/models/auth';
import { apiRequest } from './client';

export async function login(username: string, password: string): Promise<string> {
	const response = await apiRequest<{ token: string }>('/auth/login', {
		method: 'POST',
		auth: false,
		body: JSON.stringify({ username, password })
	});
	return response.token;
}

export function getCurrentUser(): Promise<HomeCoreUser> {
	return apiRequest<HomeCoreUser>('/auth/me');
}
