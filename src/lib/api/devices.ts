import type { DeviceState } from '$lib/models/device';
import { apiRequest } from './client';

export function listDevices(): Promise<DeviceState[]> {
	return apiRequest<DeviceState[]>('/devices');
}

export function getDevice(id: string): Promise<DeviceState> {
	return apiRequest<DeviceState>(`/devices/${id}`);
}

export function setDeviceState(id: string, body: Record<string, unknown>): Promise<void> {
	return apiRequest<void>(`/devices/${id}/state`, {
		method: 'PATCH',
		body: JSON.stringify(body)
	});
}
