export type DeviceState = {
	device_id: string;
	canonical_name?: string | null;
	plugin_id: string;
	name?: string | null;
	area?: string | null;
	device_type?: string | null;
	available: boolean;
	attributes: Record<string, unknown>;
};

export function deviceDisplayName(device: DeviceState): string {
	return device.name ?? device.device_id;
}
