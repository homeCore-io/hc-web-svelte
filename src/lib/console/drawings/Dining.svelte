<!-- The dining room drawing (RoomPictures): a chandelier over the table, and a lamp on the buffet. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
	const CANDLES = [450, 475, 500, 525, 550];
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}c"
			><stop offset="0" stop-color="#ffe6b8" stop-opacity=".95" /><stop
				offset="1"
				stop-color="#ffb35c"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}w"
			><stop offset="0" stop-color="#ffd9a8" stop-opacity=".85" /><stop
				offset="1"
				stop-color="#ffb35c"
				stop-opacity="0"
			/></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" /><rect
		y="204"
		width="1000"
		height="46"
		fill="#12141b"
	/>
	<ellipse cx="500" cy="110" rx="280" ry="130" fill="url(#{u}c)" opacity={op(g.chand)} />
	<ellipse cx="860" cy="120" rx="110" ry="80" fill="url(#{u}w)" opacity={op(g.buffet)} />
	<path d="M500 0v54" stroke="#3a3f4b" stroke-width="2" />
	<path d="M440 70 q60 -24 120 0" stroke="#4a4f5c" stroke-width="4" fill="none" /><path
		d="M430 70h140"
		stroke="#4a4f5c"
		stroke-width="3"
	/>
	{#each CANDLES as x (x)}<path d="M{x} 70 v-10" stroke="#4a4f5c" stroke-width="3" /><circle
			cx={x}
			cy="56"
			r="4"
			fill={g.chand ? '#ffe2a8' : '#4a4f5c'}
		/>{/each}
	<rect x="330" y="140" width="340" height="12" rx="3" fill="#2f333e" /><rect
		x="350"
		y="152"
		width="10"
		height="52"
		fill="#22252e"
	/><rect x="640" y="152" width="10" height="52" fill="#22252e" />
	<path
		d="M300 110v94M300 150h30M700 110v94M700 150h-30"
		stroke="#2a2e38"
		stroke-width="8"
		stroke-linecap="round"
	/>
	<rect x="790" y="150" width="150" height="54" rx="4" fill="#1b1e26" /><path
		d="M860 150v-26"
		stroke="#3a3f4b"
		stroke-width="4"
	/><path d="M844 124h32l-6-18h-20z" fill={shade(g.buffet)} />
	<rect
		x="60"
		y="40"
		width="150"
		height="120"
		rx="4"
		fill="#0f1622"
		stroke="#2c303b"
		stroke-width="3"
	/>
	<path d="M135 40v120M60 100h150" stroke="#2c303b" stroke-width="3" />
</svg>
