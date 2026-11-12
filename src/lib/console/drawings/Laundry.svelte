<!-- The laundry room drawing (RoomPictures): a ceiling light over the washer and dryer. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}c"
			><stop offset="0" stop-color="#eef4ff" stop-opacity=".85" /><stop
				offset="1"
				stop-color="#cfe3ff"
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
	<ellipse cx="500" cy="0" rx="380" ry="160" fill="url(#{u}c)" opacity={op(g.ceil)} /><rect
		x="400"
		y="0"
		width="200"
		height="10"
		rx="4"
		fill={shade(g.ceil)}
	/>
	<rect
		x="60"
		y="40"
		width="160"
		height="100"
		rx="4"
		fill="#0f1622"
		stroke="#2c303b"
		stroke-width="3"
	/>
	<path d="M140 40v100" stroke="#2c303b" stroke-width="3" />
	<rect x="300" y="60" width="420" height="10" rx="3" fill="#2a2e38" /><rect
		x="320"
		y="34"
		width="50"
		height="26"
		rx="3"
		fill="#252934"
	/><rect x="390" y="40" width="40" height="20" rx="3" fill="#2f3340" /><rect
		x="620"
		y="30"
		width="60"
		height="30"
		rx="3"
		fill="#252934"
	/>
	<rect x="320" y="104" width="150" height="100" rx="8" fill="#1f2230" stroke="#2c303b" /><circle
		cx="395"
		cy="160"
		r="32"
		fill="#0d0f14"
		stroke="#3a3f4b"
		stroke-width="4"
	/><rect x="330" y="112" width="60" height="8" rx="3" fill="#2c303b" />
	<rect x="490" y="104" width="150" height="100" rx="8" fill="#1f2230" stroke="#2c303b" /><circle
		cx="565"
		cy="160"
		r="32"
		fill="#0d0f14"
		stroke="#3a3f4b"
		stroke-width="4"
	/><circle cx="620" cy="116" r="4" fill="#4fe0a0" opacity={g.ceil ? 1 : 0} />
	<rect x="760" y="120" width="160" height="14" rx="3" fill="#2a2e38" /><rect
		x="770"
		y="134"
		width="140"
		height="70"
		fill="#1b1e26"
	/><path d="M840 120v-26h22" stroke="#3a3f4b" stroke-width="4" fill="none" />
</svg>
