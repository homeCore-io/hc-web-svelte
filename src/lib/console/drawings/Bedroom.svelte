<!-- The bedroom drawing (RoomPictures): a ceiling fan with its light, and a lamp either side of the bed. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}w"
			><stop offset="0" stop-color="#ffd9a8" stop-opacity=".95" /><stop
				offset="1"
				stop-color="#ffb35c"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}c"
			><stop offset="0" stop-color="#fff1d6" stop-opacity=".85" /><stop
				offset="1"
				stop-color="#ffc46b"
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
	<rect
		x="90"
		y="40"
		width="130"
		height="110"
		rx="4"
		fill="#0f1622"
		stroke="#2c303b"
		stroke-width="3"
	/>
	<path d="M155 40v110" stroke="#2c303b" stroke-width="3" /><circle
		cx="125"
		cy="70"
		r="12"
		fill="#c7d2e6"
		opacity=".35"
	/>
	<ellipse cx="560" cy="10" rx="260" ry="140" fill="url(#{u}c)" opacity={op(g.fan)} />
	<rect x="550" y="0" width="20" height="22" fill="#2a2e38" /><rect
		x="430"
		y="24"
		width="260"
		height="7"
		rx="3.5"
		fill="#3a3f4b"
	/><path d="M542 30a18 14 0 0 0 36 0z" fill={shade(g.fan)} />
	<ellipse cx="380" cy="120" rx="110" ry="90" fill="url(#{u}w)" opacity={op(g.lampL)} />
	<ellipse cx="760" cy="120" rx="110" ry="90" fill="url(#{u}w)" opacity={op(g.lampR)} />
	<rect x="420" y="96" width="300" height="60" rx="10" fill="#262a34" /><rect
		x="400"
		y="140"
		width="340"
		height="64"
		rx="12"
		fill="#1f2230"
	/>
	<rect x="430" y="118" width="110" height="30" rx="10" fill="#2f3340" /><rect
		x="600"
		y="118"
		width="110"
		height="30"
		rx="10"
		fill="#2f3340"
	/>
	<rect x="340" y="160" width="60" height="44" rx="4" fill="#1b1e26" /><rect
		x="740"
		y="160"
		width="60"
		height="44"
		rx="4"
		fill="#1b1e26"
	/>
	<path d="M370 160v-24M770 160v-24" stroke="#3a3f4b" stroke-width="4" />
	<path d="M354 136h32l-6-18h-20z" fill={shade(g.lampL)} /><path
		d="M754 136h32l-6-18h-20z"
		fill={shade(g.lampR)}
	/>
</svg>
