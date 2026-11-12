<!-- The Garage board's drawing: the ceiling and workbench lights, the zones, the heater, and two overhead doors that open with the house's. -->
<script lang="ts">
	import { op, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
	/** A door's slats, rolled up when it's open. */
	const slats = (open: boolean) => [0, 1, 2, 3, 4, 5].map((i) => (open ? 72 + i * 3 : 74 + i * 22));
	const doors = $derived([
		{ x: 420, open: !!g.oh1 },
		{ x: 650, open: !!g.oh2 }
	]);
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}c"
			><stop offset="0" stop-color="#fff1d6" stop-opacity=".9" /><stop
				offset="1"
				stop-color="#ffc46b"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}w"
			><stop offset="0" stop-color="#ffd9a8" stop-opacity=".9" /><stop
				offset="1"
				stop-color="#ffb35c"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}o"
			><stop offset="0" stop-color="#7fb8ff" stop-opacity=".55" /><stop
				offset="1"
				stop-color="#3a5b8f"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}h"
			><stop offset="0" stop-color="#ff6a3d" stop-opacity=".7" /><stop
				offset="1"
				stop-color="#ff6a3d"
				stop-opacity="0"
			/></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0d0f14" />
	<rect x="0" y="206" width="1000" height="44" fill="#13151b" />
	<ellipse cx="620" cy="10" rx="300" ry="160" fill="url(#{u}c)" opacity={op(g.ceil)} />
	<ellipse cx="900" cy="150" rx="140" ry="90" fill="url(#{u}w)" opacity={op(g.bench)} />
	<ellipse cx="380" cy="10" rx="220" ry="130" fill="url(#{u}c)" opacity={g.zone ? 0.6 : 0} />
	<ellipse cx="960" cy="200" rx="80" ry="60" fill="url(#{u}h)" opacity={g.heat ? 1 : 0} />
	{#each doors as d (d.x)}
		<rect
			x={d.x}
			y="70"
			width="190"
			height="136"
			rx="3"
			fill="#07080c"
			stroke="#2a2e38"
			stroke-width="3"
		/>
		<ellipse
			cx={d.x + 95}
			cy="200"
			rx="130"
			ry="50"
			fill="url(#{u}o)"
			opacity={d.open ? 0.35 : 0}
		/>
		{#each slats(d.open) as y, i (i)}<rect
				class="slat"
				x={d.x + 4}
				{y}
				width="182"
				height="20"
				rx="2"
				fill="#2a2e38"
				stroke="#353a46"
			/>{/each}
	{/each}
	<rect x="420" y="40" width="420" height="30" fill="#0d0f14" />
	<rect x="870" y="160" width="120" height="8" rx="3" fill="#2a2e38" />
	<path d="M905 160 v-26" stroke="#3a3f4b" stroke-width="4" /><path
		d="M890 134 h30 l-5 -14 h-20 z"
		fill={g.bench ? '#fff1d6' : '#4a4f5c'}
	/>
</svg>

<style>
	.slat {
		transition: y 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
</style>
