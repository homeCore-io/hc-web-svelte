export const API_BASE_URL =
	import.meta.env.VITE_HOMECORE_API_BASE_URL?.replace(/\/$/, '') ?? '/api/v1';

export const TOKEN_STORAGE_KEY = 'homecore.jwt';
