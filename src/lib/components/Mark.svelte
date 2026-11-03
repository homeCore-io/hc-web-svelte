<!--
	homeCore's mark, "Roof + Core": a roofline over a solid dot, on a tile in
	the theme's accent — so it is brown in light, amber in dark, and follows a
	household's palette. The same drawing as the icons
	(`scripts/make-icons.mjs`): change both.
-->
<script lang="ts">
	let { size = 30 }: { size?: number } = $props();
</script>

<svg class="mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
	<rect width="64" height="64" rx="14" />
	<path
		d="M11.5 29 L32 11.5 L52.5 29"
		fill="none"
		stroke-width="8.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<circle cx="32" cy="47.5" r="8" />
</svg>

<style>
	.mark {
		flex: none;
		display: block;
	}
	rect {
		fill: var(--accent);
	}
	path {
		stroke: var(--accent-ink);
	}
	circle {
		fill: var(--accent-ink);
	}
</style>
