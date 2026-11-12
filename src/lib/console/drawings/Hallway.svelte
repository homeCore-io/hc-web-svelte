<!-- The hallway drawing (RoomPictures): three ceiling lights down the hall to a door. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}c"
			><stop offset="0" stop-color="#fff1d6" stop-opacity=".85" /><stop
				offset="1"
				stop-color="#ffc46b"
				stop-opacity="0"
			/></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" />
	<path d="M0 0 L380 80 L620 80 L1000 0Z" fill="#101219" /><path
		d="M0 250 L380 170 L620 170 L1000 250Z"
		fill="#13151c"
	/>
	<rect x="380" y="80" width="240" height="90" fill="#0b0d12" /><rect
		x="460"
		y="96"
		width="80"
		height="74"
		rx="3"
		fill="#1d2029"
		stroke="#3a3f4b"
		stroke-width="2"
	/><circle cx="528" cy="136" r="3" fill="#c7cdd8" />
	<ellipse cx="180" cy="40" rx="200" ry="120" fill="url(#{u}c)" opacity={op(g.c1)} />
	<ellipse cx="500" cy="70" rx="160" ry="90" fill="url(#{u}c)" opacity={op(g.c2)} />
	<ellipse cx="820" cy="40" rx="200" ry="120" fill="url(#{u}c)" opacity={op(g.c3)} />
	<ellipse cx="180" cy="22" rx="26" ry="8" fill={shade(g.c1)} /><ellipse
		cx="500"
		cy="84"
		rx="14"
		ry="4"
		fill={shade(g.c2)}
	/><ellipse cx="820" cy="22" rx="26" ry="8" fill={shade(g.c3)} />
	<rect
		x="120"
		y="80"
		width="70"
		height="56"
		rx="3"
		fill="#181b23"
		stroke="#2c303b"
		stroke-width="3"
		transform="skewY(8)"
	/><rect
		x="810"
		y="200"
		width="70"
		height="56"
		rx="3"
		fill="#181b23"
		stroke="#2c303b"
		stroke-width="3"
		transform="translate(0,-110) skewY(-8)"
	/>
	<path d="M430 250 L470 170 L530 170 L570 250Z" fill="#2a1f22" opacity=".8" />
</svg>
