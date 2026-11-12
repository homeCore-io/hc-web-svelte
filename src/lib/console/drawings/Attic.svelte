<!-- The attic drawing (RoomPictures): one bulb under the rafters. -->
<script lang="ts">
	import { op, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}b"
			><stop offset="0" stop-color="#ffe2a8" stop-opacity=".95" /><stop
				offset="1"
				stop-color="#ffb35c"
				stop-opacity="0"
			/></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0b0c10" />
	<path d="M0 250 L500 10 L1000 250Z" fill="#14161c" />
	<g stroke="#2a2016" stroke-width="10"
		><path d="M500 10 L120 250M500 10 L300 250M500 10 L700 250M500 10 L880 250" /></g
	>
	<path d="M0 250 L500 10 L1000 250" stroke="#3a2c1e" stroke-width="12" fill="none" />
	<ellipse cx="500" cy="120" rx="300" ry="150" fill="url(#{u}b)" opacity={op(g.bulb)} />
	<path d="M500 10v80" stroke="#3a3f4b" stroke-width="2" /><circle
		cx="500"
		cy="98"
		r="10"
		fill={g.bulb ? '#fff3cf' : '#5a5f6b'}
	/>
	<rect x="260" y="180" width="90" height="60" rx="3" fill="#3a2e22" /><rect
		x="340"
		y="200"
		width="70"
		height="40"
		rx="3"
		fill="#2f261c"
	/><rect x="620" y="190" width="110" height="50" rx="3" fill="#3a2e22" /><path
		d="M260 196h90M620 206h110"
		stroke="#251d14"
		stroke-width="3"
	/>
</svg>
