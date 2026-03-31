export type ModeState = {
	device_id: string;
	name?: string | null;
	kind?: string | null;
	on?: boolean;
	on_offset_minutes?: number;
	off_offset_minutes?: number;
	sunset_today?: string | null;
	sunrise_today?: string | null;
	effective_on?: string | null;
	effective_off?: string | null;
	attributes: Record<string, unknown>;
};

export function parseModeState(input: unknown): ModeState {
	const value = input as Record<string, unknown>;
	const config = ((value.config as Record<string, unknown> | undefined) ?? value) as Record<
		string,
		unknown
	>;
	const state = (value.state as Record<string, unknown> | undefined) ?? {};
	const attributes = ((state.attributes as Record<string, unknown> | undefined) ??
		(value.attributes as Record<string, unknown> | undefined) ??
		{}) as Record<string, unknown>;

	return {
		device_id: String(config.id ?? value.device_id ?? value.id),
		name: (value.name as string | undefined) ?? null,
		kind: (config.kind as string | undefined) ?? 'manual',
		on: (attributes.on as boolean | undefined) ?? false,
		on_offset_minutes: Number(
			(config.on_offset_minutes as number | undefined) ??
				(attributes.on_offset_minutes as number | undefined) ??
				0
		),
		off_offset_minutes: Number(
			(config.off_offset_minutes as number | undefined) ??
				(attributes.off_offset_minutes as number | undefined) ??
				0
		),
		sunset_today: (attributes.sunset_today as string | undefined) ?? null,
		sunrise_today: (attributes.sunrise_today as string | undefined) ?? null,
		effective_on: (attributes.effective_on as string | undefined) ?? null,
		effective_off: (attributes.effective_off as string | undefined) ?? null,
		attributes
	};
}

export function modeDisplayName(mode: ModeState): string {
	if (mode.name) return mode.name;
	if (mode.device_id === 'mode_night') return 'Night Mode';
	return mode.device_id.replace(/^mode_/, '').replaceAll('_', ' ');
}

export function modeStatusLabel(mode: ModeState): string {
	return mode.on ? 'On' : 'Off';
}

export function modeWindowSummary(mode: ModeState): string {
	const on = mode.effective_on ?? 'Unknown';
	const off = mode.effective_off ?? 'Unknown';
	return `${on} to ${off}`;
}
