import type { Scene } from '$lib/models/scene';
import { apiRequest } from './client';

export function listScenes(): Promise<Scene[]> {
	return apiRequest<Scene[]>('/scenes');
}
