export type DeviceState = {
	device_id: string;
	canonical_name?: string | null;
	plugin_id: string;
	name?: string | null;
	area?: string | null;
	device_type?: string | null;
	available: boolean;
	last_seen?: string | null;
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

export function isSceneLikeDevice(device: DeviceState): boolean {
	const deviceType = String(device.device_type ?? '').toLowerCase();
	const kind = String(device.attributes.kind ?? '').toLowerCase();
	return deviceType === 'scene' || kind === 'scene';
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

export function mediaImageUrl(device: DeviceState): string | null {
	return (device.attributes.media_image_url as string | undefined) ?? null;
}

export function intAttr(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
	return null;
}

export function boolAttr(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null;
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

export function mediaSummary(device: DeviceState): string | null {
	const title = mediaTitle(device);
	const artist = mediaArtist(device);
	if (artist && title) return `${artist} - ${title}`;
	return title ?? artist ?? mediaAlbum(device) ?? mediaSource(device);
}

export function statusText(device: DeviceState): string {
	if (!device.available) return 'Offline';
	if (isMediaPlayer(device)) {
		const state = playbackState(device);
		if (state === 'playing') return 'Playing';
		if (state === 'paused') return 'Paused';
		if (state === 'stopped') return 'Stopped';
		return state.replaceAll('_', ' ');
	}
	const on = boolAttr(device.attributes.on);
	if (on !== null) return on ? 'On' : 'Off';
	const open = boolAttr(device.attributes.open);
	if (open !== null) return open ? 'Open' : 'Closed';
	const motion = boolAttr(device.attributes.motion);
	if (motion !== null) return motion ? 'Motion detected' : 'Clear';
	const contact = boolAttr(device.attributes.contact);
	if (contact !== null) return contact ? 'Open' : 'Closed';
	const locked = boolAttr(device.attributes.locked);
	if (locked !== null) return locked ? 'Locked' : 'Unlocked';
	const value = device.attributes.state;
	if (typeof value === 'string' && value.trim()) {
		return value.replaceAll('_', ' ');
	}
	return device.device_type?.replaceAll('_', ' ') ?? 'Ready';
}

export function statusIcon(device: DeviceState): string {
	if (!device.available) return '●';
	if (isMediaPlayer(device)) {
		const state = playbackState(device);
		if (state === 'playing') return '▶';
		if (state === 'paused') return '⏸';
		if (state === 'stopped') return '■';
		return '♫';
	}
	const on = boolAttr(device.attributes.on);
	if (on !== null) return on ? '●' : '○';
	const locked = boolAttr(device.attributes.locked);
	if (locked !== null) return locked ? '🔒' : '🔓';
	const motion = boolAttr(device.attributes.motion);
	if (motion !== null) return motion ? '◉' : '○';
	const open = boolAttr(device.attributes.open ?? device.attributes.contact);
	if (open !== null) return open ? '▣' : '□';
	return '•';
}

export function statusTone(device: DeviceState): 'good' | 'warn' | 'idle' | 'media' | 'offline' {
	if (!device.available) return 'offline';
	if (isMediaPlayer(device)) return 'media';
	const on = boolAttr(device.attributes.on);
	if (on !== null) return on ? 'good' : 'idle';
	const motion = boolAttr(device.attributes.motion);
	if (motion !== null) return motion ? 'warn' : 'idle';
	const open = boolAttr(device.attributes.open ?? device.attributes.contact);
	if (open !== null) return open ? 'warn' : 'idle';
	return 'idle';
}

export function sortText(value: string | null | undefined): string {
	return (value ?? '').trim().toLowerCase();
}

export function lastSeenMs(device: DeviceState): number {
	const raw = device.last_seen;
	if (!raw) return 0;
	const parsed = Date.parse(raw);
	return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatRelativeTime(isoValue: string | null | undefined): string {
	if (!isoValue) return 'Unknown';
	const parsed = Date.parse(isoValue);
	if (Number.isNaN(parsed)) return 'Unknown';
	const diffMs = Date.now() - parsed;
	const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
	if (diffSeconds < 60) return `${diffSeconds}s ago`;
	const diffMinutes = Math.floor(diffSeconds / 60);
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays}d ago`;
}

export function supportsInlineToggle(device: DeviceState): boolean {
	return boolAttr(device.attributes.on) !== null;
}
