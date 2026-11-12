<!-- The Office board's drawing: an overhead light and two ceiling lights, two desk lamps, and the TV. -->
<script lang="ts">
	import { op, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
	const lamp = (v: number | undefined) => (v ? '#fff1d6' : '#4a4f5c');
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
			><stop offset="0" stop-color="#fff1d6" stop-opacity=".9" /><stop
				offset="1"
				stop-color="#ffc46b"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}t"
			><stop offset="0" stop-color="#8a5cff" stop-opacity=".8" /><stop
				offset="1"
				stop-color="#3a1b6b"
				stop-opacity="0"
			/></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" />
	<rect x="0" y="196" width="1000" height="54" fill="#12141b" />
	<ellipse cx="520" cy="10" rx="200" ry="140" fill="url(#{u}c)" opacity={op(g.c1)} />
	<ellipse cx="760" cy="10" rx="200" ry="140" fill="url(#{u}c)" opacity={op(g.c2)} />
	<ellipse cx="640" cy="20" rx="260" ry="160" fill="url(#{u}c)" opacity={op(g.over)} />
	<ellipse cx="560" cy="150" rx="150" ry="100" fill="url(#{u}w)" opacity={op(g.odl)} />
	<ellipse cx="700" cy="150" rx="120" ry="90" fill="url(#{u}w)" opacity={op(g.dl)} />
	<ellipse cx="880" cy="120" rx="180" ry="110" fill="url(#{u}t)" opacity={g.tv ? 1 : 0} />
	<rect x="500" y="0" width="40" height="8" rx="3" fill="#2a2e38" /><rect
		x="740"
		y="0"
		width="40"
		height="8"
		rx="3"
		fill="#2a2e38"
	/>
	<rect x="620" y="0" width="40" height="12" rx="4" fill={g.over ? '#fff1d6' : '#3a3f4b'} />
	<rect x="810" y="70" width="150" height="88" rx="6" fill="#16131f" stroke="#2c2f3a" />
	<rect x="816" y="76" width="138" height="76" rx="3" fill="#2a1a4a" opacity={g.tv ? 1 : 0} />
	<rect x="470" y="150" width="280" height="10" rx="3" fill="#2a2e38" />
	<rect x="485" y="160" width="8" height="40" fill="#22252e" /><rect
		x="727"
		y="160"
		width="8"
		height="40"
		fill="#22252e"
	/>
	<path
		d="M540 150 l0 -55 l30 -18"
		stroke="#3a3f4b"
		stroke-width="5"
		fill="none"
		stroke-linecap="round"
	/><path d="M556 70 l34 14 l-14 18 z" fill={lamp(g.odl)} />
	<path d="M700 150 v-34" stroke="#3a3f4b" stroke-width="4" /><path
		d="M684 116 h32 l-6 -18 h-20 z"
		fill={lamp(g.dl)}
	/>
	<rect x="600" y="120" width="60" height="30" rx="3" fill="#1b1e26" />
</svg>
