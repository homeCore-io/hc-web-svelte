import { parseModeState, type ModeState } from '$lib/models/mode';
import { apiRequest } from './client';

export async function listModes(): Promise<ModeState[]> {
	const response = await apiRequest<unknown[]>('/modes');
	return response.map(parseModeState);
}
