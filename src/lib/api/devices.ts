import type { DeviceState } from '$lib/models/device';
import { apiRequest } from './client';

export function listDevices(): Promise<DeviceState[]> {
	return apiRequest<DeviceState[]>('/devices');
}
