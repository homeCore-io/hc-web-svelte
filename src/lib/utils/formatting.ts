export function titleCase(value: string): string {
	return value
		.split(/[_\s]+/)
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join(' ');
}
