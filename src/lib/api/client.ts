import { API_BASE_URL, TOKEN_STORAGE_KEY } from '$lib/config';

export class ApiError extends Error {
	status: number;
	body: unknown;

	constructor(message: string, status: number, body: unknown) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

type RequestOptions = RequestInit & {
	auth?: boolean;
};

function getStoredToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const headers = new Headers(options.headers);
	headers.set('Accept', 'application/json');

	const hasBody = options.body !== undefined && options.body !== null;
	if (hasBody && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	if (options.auth !== false) {
		const token = getStoredToken();
		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
		}
	}

	const response = await fetch(`${API_BASE_URL}${path}`, {
		...options,
		headers
	});

	let body: unknown = null;
	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		body = await response.json();
	} else if (response.status !== 204) {
		body = await response.text();
	}

	if (!response.ok) {
		const message =
			(typeof body === 'object' &&
				body !== null &&
				'error' in body &&
				typeof (body as { error?: unknown }).error === 'string' &&
				(body as { error: string }).error) ||
			`${response.status} ${response.statusText}`;
		throw new ApiError(message, response.status, body);
	}

	return body as T;
}
