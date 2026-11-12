<!-- The bathroom drawing (RoomPictures): the vanity's light over the mirror, and a ceiling light. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<linearGradient id="{u}v" x1="0" x2="0" y1="0" y2="1"
			><stop offset="0" stop-color="#fff4dc" stop-opacity=".9" /><stop
				offset="1"
				stop-color="#ffd9a8"
				stop-opacity="0"
			/></linearGradient
		>
		<radialGradient id="{u}c"
			><stop offset="0" stop-color="#eaf2ff" stop-opacity=".8" /><stop
				offset="1"
				stop-color="#cfe3ff"
				stop-opacity="0"
			/></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" /><rect
		y="200"
		width="1000"
		height="50"
		fill="#14171e"
	/>
	<path d="M0 200h1000" stroke="#22262f" /><g stroke="#161920"
		><path d="M0 120h330M0 160h330M110 80v120M220 80v120" /></g
	>
	<ellipse cx="560" cy="0" rx="260" ry="130" fill="url(#{u}c)" opacity={op(g.ceil)} /><circle
		cx="560"
		cy="8"
		r="16"
		fill={shade(g.ceil)}
	/>
	<rect x="430" y="40" width="200" height="12" rx="6" fill={shade(g.vanity)} /><rect
		x="420"
		y="52"
		width="220"
		height="110"
		fill="url(#{u}v)"
		opacity={op(g.vanity)}
	/>
	<rect
		x="450"
		y="62"
		width="160"
		height="80"
		rx="8"
		fill="#141922"
		stroke="#2c303b"
		stroke-width="3"
	/>
	<rect x="420" y="150" width="220" height="14" rx="3" fill="#2a2e38" /><rect
		x="430"
		y="164"
		width="200"
		height="36"
		fill="#1b1e26"
	/><ellipse cx="530" cy="157" rx="40" ry="6" fill="#0d0f14" />
	<rect x="700" y="130" width="250" height="70" rx="30" fill="#20232c" stroke="#2c303b" /><path
		d="M930 130v-60h-30"
		stroke="#3a3f4b"
		stroke-width="4"
		fill="none"
	/>
	<rect
		x="40"
		y="70"
		width="150"
		height="130"
		rx="4"
		fill="#0f141c"
		stroke="#2c303b"
		stroke-width="3"
	/>
	<path d="M115 70v-30M100 40h30" stroke="#3a3f4b" stroke-width="3" />
</svg>
