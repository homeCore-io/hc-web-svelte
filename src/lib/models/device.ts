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

export function deviceCanonicalReference(device: DeviceState): string {
	return device.canonical_name ?? device.device_id;
}

export function isMediaPlayer(device: DeviceState): boolean {
	return (
		device.device_type === 'media_player' ||
		(device.attributes.kind as string | undefined) === 'media_player'
	);
}

export function playbackState(device: DeviceState): string {
	return String(device.attributes.state ?? 'unknown').toLowerCase();
}

export function mediaTitle(device: DeviceState): string | null {
	return (device.attributes.title as string | undefined) ?? (device.attributes.media_title as string | undefined) ?? null;
}

export function mediaArtist(device: DeviceState): string | null {
	return (device.attributes.artist as string | undefined) ?? (device.attributes.media_artist as string | undefined) ?? null;
}

export function mediaAlbum(device: DeviceState): string | null {
	return (device.attributes.album as string | undefined) ?? (device.attributes.media_album as string | undefined) ?? null;
}

export function mediaSource(device: DeviceState): string | null {
	return (device.attributes.source as string | undefined) ?? null;
}

export function intAttr(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
	return null;
}

export function positionSecs(device: DeviceState): number | null {
	return intAttr(device.attributes.position_secs ?? device.attributes.media_position);
}

export function durationSecs(device: DeviceState): number | null {
	return intAttr(device.attributes.duration_secs ?? device.attributes.media_duration);
}

export function volumePercent(device: DeviceState): number | null {
	return intAttr(device.attributes.volume);
}

export function muted(device: DeviceState): boolean | null {
	return typeof device.attributes.muted === 'boolean' ? (device.attributes.muted as boolean) : null;
}

export function supportedActions(device: DeviceState): string[] {
	return Array.isArray(device.attributes.supported_actions)
		? (device.attributes.supported_actions as unknown[]).filter((value): value is string => typeof value === 'string')
		: [];
}

export function uiEnrichments(device: DeviceState): string[] {
	return Array.isArray(device.attributes.ui_enrichments)
		? (device.attributes.ui_enrichments as unknown[]).filter((value): value is string => typeof value === 'string')
		: [];
}

export function sonosData(device: DeviceState): Record<string, unknown> {
	return (device.attributes.sonos as Record<string, unknown> | undefined) ?? {};
}

export function supportsAction(device: DeviceState, action: string): boolean {
	const actions = supportedActions(device);
	if (actions.length > 0) return actions.includes(action);
	if (!isMediaPlayer(device)) return false;
	return ['play', 'pause'].includes(action) ||
		(action === 'set_volume' && volumePercent(device) !== null) ||
		(action === 'set_mute' && muted(device) !== null);
}

export function formatDuration(totalSeconds: number | null): string {
	if (totalSeconds === null || totalSeconds < 0) return '--:--';
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
