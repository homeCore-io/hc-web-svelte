export function titleCase(value: string): string {
	return value
		.split(/[_\s]+/)
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join(' ');
}

export function formatShortTimestamp(isoValue: string | null | undefined): string {
	if (!isoValue) return 'Unknown time';
	const parsed = Date.parse(isoValue);
	if (Number.isNaN(parsed)) return 'Unknown time';
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(parsed);
}
