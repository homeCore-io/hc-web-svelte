<!--
	One ecosystem's tabs (Devices over MQTT): its devices, the logins its
	devices use, and the profile itself.
-->
<script lang="ts">
	let {
		name,
		file,
		current
	}: { name: string; file: string | null; current: 'devices' | 'logins' | 'profile' } = $props();
	const base = $derived(`/settings/mqtt/${encodeURIComponent(name)}`);
	const tabs = $derived([
		{ id: 'devices', label: 'Devices', href: base },
		{ id: 'logins', label: 'Logins', href: `${base}/logins` },
		...(file
			? [
					{
						id: 'profile',
						label: 'Profile',
						href: `/settings/mqtt/files/${encodeURIComponent(file)}`
					}
				]
			: [])
	]);
</script>

<nav aria-label="Ecosystem">
	{#each tabs as t (t.id)}
		<a href={t.href} aria-current={current === t.id ? 'page' : undefined}>{t.label}</a>
	{/each}
</nav>

<style>
	nav {
		display: flex;
		gap: 4px;
		border-bottom: 1px solid var(--line);
	}
	a {
		padding: 10px 14px;
		color: var(--ink-muted);
		font-weight: 600;
		text-decoration: none;
		border-bottom: 3px solid transparent;
	}
	a[aria-current='page'] {
		color: var(--ink);
		font-weight: 700;
		border-bottom-color: var(--accent);
	}
</style>
