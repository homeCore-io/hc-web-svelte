import { parseScene, type Scene } from '$lib/models/scene';
import { apiRequest } from './client';

export async function listScenes(): Promise<Scene[]> {
	const response = await apiRequest<unknown[]>('/scenes');
	return response.map(parseScene);
}
