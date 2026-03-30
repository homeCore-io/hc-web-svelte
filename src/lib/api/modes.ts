import type { ModeState } from '$lib/models/mode';
import { apiRequest } from './client';

export function listModes(): Promise<ModeState[]> {
	return apiRequest<ModeState[]>('/modes');
}
