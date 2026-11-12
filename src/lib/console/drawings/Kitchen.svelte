<!-- The kitchen drawing (RoomPictures): two pendants over the island, and lights under the cabinets. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
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
		<linearGradient id="{u}u" x1="0" x2="0" y1="0" y2="1"
			><stop offset="0" stop-color="#ffd9a8" stop-opacity=".9" /><stop
				offset="1"
				stop-color="#ffb35c"
				stop-opacity="0"
			/></linearGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" /><rect
		y="200"
		width="1000"
		height="50"
		fill="#12141b"
	/>
	<rect
		x="380"
		y="20"
		width="160"
		height="90"
		rx="4"
		fill="#101826"
		stroke="#2c303b"
		stroke-width="3"
	/>
	<path d="M460 20v90M380 65h160" stroke="#2c303b" stroke-width="3" />
	<rect x="60" y="20" width="300" height="70" rx="4" fill="#1a1d25" /><rect
		x="560"
		y="20"
		width="300"
		height="70"
		rx="4"
		fill="#1a1d25"
	/>
	<rect x="60" y="90" width="300" height="34" fill="url(#{u}u)" opacity={op(g.ucl)} /><rect
		x="560"
		y="90"
		width="300"
		height="34"
		fill="url(#{u}u)"
		opacity={op(g.ucr)}
	/>
	<rect x="60" y="124" width="800" height="12" rx="2" fill="#2a2e38" /><rect
		x="60"
		y="136"
		width="800"
		height="64"
		fill="#191c24"
	/>
	<rect x="880" y="30" width="90" height="170" rx="6" fill="#20232c" stroke="#2c303b" /><path
		d="M895 100h6"
		stroke="#4a4f5c"
		stroke-width="4"
	/>
	<ellipse cx="380" cy="150" rx="150" ry="90" fill="url(#{u}c)" opacity={op(g.p1)} />
	<ellipse cx="620" cy="150" rx="150" ry="90" fill="url(#{u}c)" opacity={op(g.p2)} />
	<path d="M380 0v110M620 0v110" stroke="#3a3f4b" stroke-width="2" />
	<path d="M360 110h40l-8 18h-24z" fill={shade(g.p1)} /><path
		d="M600 110h40l-8 18h-24z"
		fill={shade(g.p2)}
	/>
	<rect x="300" y="168" width="400" height="14" rx="3" fill="#2f333e" /><rect
		x="310"
		y="182"
		width="380"
		height="18"
		fill="#1d2029"
	/>
</svg>
