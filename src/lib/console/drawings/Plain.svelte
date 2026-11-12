<!-- A room no drawing fits: a plain wall and floor, lit from the ceiling. -->
<script lang="ts">
	import { op, type Glow } from '../pictures.js';

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
		<linearGradient id="{u}b" x1="0" x2="0" y1="0" y2="1"
			><stop offset="0" stop-color="#161922" /><stop
				offset="1"
				stop-color="#0c0d12"
			/></linearGradient
		>
	</defs>
	<rect width="1000" height="250" fill="url(#{u}b)" />
	<rect y="204" width="1000" height="46" fill="#12141b" />
	<ellipse cx="620" cy="0" rx="380" ry="160" fill="url(#{u}c)" opacity={op(g.ceil)} />
</svg>
