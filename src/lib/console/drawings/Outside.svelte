<!-- The outside drawing (RoomPictures), twice as wide: the house at night, its porch light, a flood and the path lights. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
	const PATH = [300, 420, 540];
</script>

<svg viewBox="0 0 2000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}p"
			><stop offset="0" stop-color="#ffd9a8" stop-opacity=".95" /><stop
				offset="1"
				stop-color="#ffb35c"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}f"
			><stop offset="0" stop-color="#eaf2ff" stop-opacity=".85" /><stop
				offset="1"
				stop-color="#bcd4ff"
				stop-opacity="0"
			/></radialGradient
		>
		<linearGradient id="{u}s" x1="0" x2="0" y1="0" y2="1"
			><stop offset="0" stop-color="#0a1020" /><stop
				offset="1"
				stop-color="#121a2c"
			/></linearGradient
		>
	</defs>
	<rect width="2000" height="250" fill="url(#{u}s)" /><circle
		cx="1720"
		cy="50"
		r="22"
		fill="#e9eef8"
		opacity=".85"
	/>
	<g fill="#c7d2e6" opacity=".6"
		><circle cx="200" cy="30" r="1.5" /><circle cx="420" cy="60" r="1.2" /><circle
			cx="1500"
			cy="30"
			r="1.5"
		/><circle cx="1880" cy="90" r="1.2" /><circle cx="900" cy="20" r="1.2" /></g
	>
	<rect y="210" width="2000" height="40" fill="#0d1610" />
	<path d="M600 210 V110 L900 30 L1200 110 V210Z" fill="#161922" /><path
		d="M580 112 L900 24 L1220 112"
		stroke="#2c303b"
		stroke-width="10"
		fill="none"
	/>
	<rect
		x="860"
		y="140"
		width="80"
		height="70"
		rx="3"
		fill="#1d2029"
		stroke="#3a3f4b"
		stroke-width="2"
	/>
	<rect x="680" y="130" width="90" height="50" rx="3" fill="#1a2233" /><rect
		x="1030"
		y="130"
		width="90"
		height="50"
		rx="3"
		fill="#1a2233"
	/>
	<ellipse cx="830" cy="170" rx="120" ry="80" fill="url(#{u}p)" opacity={op(g.porch)} /><rect
		x="824"
		y="150"
		width="12"
		height="18"
		rx="3"
		fill={shade(g.porch)}
	/>
	<ellipse cx="1260" cy="210" rx="300" ry="90" fill="url(#{u}f)" opacity={op(g.flood)} /><path
		d="M1200 110 l40 10"
		stroke="#3a3f4b"
		stroke-width="5"
	/><rect x="1236" y="114" width="22" height="12" rx="3" fill={shade(g.flood)} />
	{#each PATH as x (x)}<ellipse
			cx={x}
			cy="214"
			rx="50"
			ry="14"
			fill="url(#{u}p)"
			opacity={op(g.path)}
		/><rect x={x - 3} y="196" width="6" height="16" rx="2" fill={shade(g.path)} />{/each}
	<path d="M200 210 q20 -90 60 -100 q40 10 60 100z" fill="#0f1a12" /><path
		d="M1500 210 q30 -120 80 -130 q50 10 80 130z"
		fill="#0f1a12"
	/>
</svg>
