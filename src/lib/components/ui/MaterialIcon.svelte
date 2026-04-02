<script lang="ts">
	export type MaterialIconName =
		| 'home'
		| 'dashboard'
		| 'devices'
		| 'device_grid'
		| 'device_list'
		| 'device_tile'
		| 'summary'
		| 'modes'
		| 'scenes'
		| 'events'
		| 'automation'
		| 'history'
		| 'media'
		| 'camera'
		| 'embed'
		| 'note'
		| 'link'
		| 'power'
		| 'power_off'
		| 'lock'
		| 'lock_open'
		| 'motion'
		| 'open'
		| 'closed'
		| 'play'
		| 'pause'
		| 'stop'
		| 'warning'
		| 'offline'
		| 'check';

	let {
		name,
		size = 20,
		title = null,
		class: className = ''
	}: {
		name: MaterialIconName;
		size?: number;
		title?: string | null;
		class?: string;
	} = $props();

	const paths: Record<MaterialIconName, string[]> = {
		home: ['M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'],
		dashboard: ['M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z'],
		devices: ['M4 6h18v12H4zm0 0-2 2v12h18v2H2V8zm6 13h6v1h-6z'],
		device_grid: ['M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z'],
		device_list: ['M4 6h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8z'],
		device_tile: ['M5 5h14v14H5zM8 8h8v8H8z'],
		summary: ['M4 19h16v2H4zM6 10h3v7H6zm5-4h3v11h-3zm5 2h3v9h-3z'],
		modes: ['M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5z'],
		scenes: ['M12 2l2.39 4.84L20 9.27l-4 3.89.94 5.5L12 16.9l-4.94 2.76.94-5.5-4-3.89 5.61-.43z'],
		events: ['M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m0 16H5V8h14z'],
		automation: ['M11 21h-1l1-7H7.5a1 1 0 0 1-.8-1.6L13 3h1l-1 7h3.5a1 1 0 0 1 .8 1.6z'],
		history: ['M13 3a9 9 0 1 0 8.95 10h-2.02A7 7 0 1 1 13 5c1.93 0 3.68.78 4.95 2.05L15 10h7V3l-2.62 2.62A8.96 8.96 0 0 0 13 3m-1 5h2v6h-5v-2h3z'],
		media: ['M8 5v14l11-7z'],
		camera: ['M9 4 7.17 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.17L15 4zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10'],
		embed: ['M8.59 16.59 4 12l4.59-4.59L10 8.82 6.83 12 10 15.18zm6.82 0L14 15.18 17.17 12 14 8.82l1.41-1.41L20 12zm-3.41-9.18h2L10.83 21h-2z'],
		note: ['M14 2H6a2 2 0 0 0-2 2v16l4-4h10a2 2 0 0 0 2-2V8z'],
		link: ['M3.9 12a5 5 0 0 1 5-5h4v2h-4a3 3 0 1 0 0 6h4v2h-4a5 5 0 0 1-5-5m6-1h4v2h-4zm5.2-4h-4v2h4a3 3 0 0 1 0 6h-4v2h4a5 5 0 1 0 0-10'],
		power: ['M13 3h-2v10h2zm4.83 2.17-1.42 1.42A6.97 6.97 0 0 1 19 12a7 7 0 1 1-14 0c0-2.03.86-3.87 2.24-5.16L5.83 5.41A8.96 8.96 0 0 0 3 12a9 9 0 1 0 18 0c0-2.5-1.02-4.77-2.67-6.41'],
		power_off: ['M13 3h-2v8h2zm5.77 14.36L5.64 4.23 4.23 5.64l2.35 2.35A8.95 8.95 0 0 0 3 12a9 9 0 0 0 15.77 5.36M7 12c0-1.36.46-2.61 1.24-3.61l7.37 7.37A6.96 6.96 0 0 1 7 12m12.41 0c0 .9-.17 1.77-.49 2.56l1.49 1.49A8.96 8.96 0 0 0 21 12c0-2.5-1.02-4.77-2.67-6.41l-1.42 1.42A6.96 6.96 0 0 1 19.41 12'],
		lock: ['M12 17a2 2 0 0 1-2-2 2 2 0 1 1 4 0 2 2 0 0 1-2 2m6-8h-1V7A5 5 0 0 0 7 7v2H6a2 2 0 0 0-2 2v9h16v-9a2 2 0 0 0-2-2m-3 0H9V7a3 3 0 0 1 6 0z'],
		lock_open: ['M12 17a2 2 0 0 1-2-2 2 2 0 1 1 4 0 2 2 0 0 1-2 2m6-8H9V7a3 3 0 0 1 5.83-1H17a5 5 0 0 0-10 1v2H6a2 2 0 0 0-2 2v9h16v-9a2 2 0 0 0-2-2'],
		motion: ['M13.5 5.5A2.5 2.5 0 1 1 11 3a2.5 2.5 0 0 1 2.5 2.5M9.8 8 7 22h2.2l1.8-8 2 2v6H15v-7l-2.6-2.4.8-4A7 7 0 0 0 19 12v-2a5 5 0 0 1-4-2.03L13.5 6z'],
		open: ['M4 19h16v2H4zm2-4h12V5H6zm2-8h8v6H8z'],
		closed: ['M6 5h12v10H6zm-2 12h16v2H4z'],
		play: ['M8 5v14l11-7z'],
		pause: ['M6 19h4V5H6zm8-14v14h4V5z'],
		stop: ['M6 6h12v12H6z'],
		warning: ['M1 21h22L12 2zm12-3h-2v2h2zm0-8h-2v6h2z'],
		offline: ['M12 2a10 10 0 0 1 9.95 9H20a8 8 0 0 0-13.66-5.66l1.42 1.42A6 6 0 0 1 18 11h-2a4 4 0 0 0-6.83-2.83l1.42 1.42A2 2 0 0 1 14 11h-2.17l6.58 6.58A9.96 9.96 0 0 1 12 22a10 10 0 0 1-8.49-15.28L1.39 4.61 2.8 3.2l18 18-1.41 1.41-3.28-3.28A9.95 9.95 0 0 1 12 22'],
		check: ['M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z']
	};
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="currentColor"
	class={className}
	aria-hidden={title ? undefined : 'true'}
	role={title ? 'img' : undefined}
>
	{#if title}
		<title>{title}</title>
	{/if}
	{#each paths[name] as path}
		<path d={path}></path>
	{/each}
</svg>
