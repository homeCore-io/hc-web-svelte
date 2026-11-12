<!-- The Living Room board's drawing: two ceiling lights, floor, sofa, tower and arch lamps, the TV and its lightstrip, holiday lights, and the door with its lock. -->
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
		<radialGradient id="{u}s"
			><stop offset="0" stop-color="#9a6bff" stop-opacity=".8" /><stop
				offset="1"
				stop-color="#4a2a9a"
				stop-opacity="0"
			/></radialGradient
		>
		<radialGradient id="{u}h"
			><stop offset="0" stop-color="#ff5a7a" stop-opacity=".6" /><stop
				offset=".5"
				stop-color="#4fe0a0"
				stop-opacity=".3"
			/><stop offset="1" stop-color="#4fe0a0" stop-opacity="0" /></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" />
	<rect x="0" y="198" width="1000" height="52" fill="#12141b" />
	<ellipse cx="520" cy="0" rx="220" ry="140" fill="url(#{u}c)" opacity={op(g.c1)} />
	<ellipse cx="780" cy="0" rx="220" ry="140" fill="url(#{u}c)" opacity={op(g.c2)} />
	<ellipse cx="900" cy="130" rx="150" ry="70" fill="url(#{u}s)" opacity={op(g.strip)} />
	<ellipse cx="420" cy="70" rx="140" ry="140" fill="url(#{u}w)" opacity={op(g.floor2)} />
	<ellipse cx="470" cy="80" rx="110" ry="120" fill="url(#{u}w)" opacity={op(g.floor)} />
	<ellipse cx="620" cy="140" rx="110" ry="80" fill="url(#{u}w)" opacity={op(g.sofa)} />
	<ellipse cx="560" cy="40" rx="120" ry="110" fill="url(#{u}w)" opacity={op(g.tower)} />
	<ellipse cx="700" cy="60" rx="140" ry="110" fill="url(#{u}w)" opacity={op(g.arch)} />
	<ellipse cx="640" cy="8" rx="420" ry="34" fill="url(#{u}h)" opacity={g.hol ? 0.7 : 0} />
	<rect x="830" y="70" width="150" height="86" rx="6" fill="#16131f" stroke="#2c2f3a" />
	<rect x="836" y="76" width="138" height="74" rx="3" fill="#2a1a4a" opacity={g.tv ? 1 : 0} />
	<rect x="520" y="132" width="250" height="66" rx="18" fill="#1d2029" />
	<rect x="508" y="118" width="274" height="34" rx="16" fill="#252934" />
	<path d="M430 198 v-140" stroke="#3a3f4b" stroke-width="5" /><path
		d="M402 58 h56 l-10 -26 h-36 z"
		fill={lamp(g.floor ?? g.floor2)}
	/>
	<path d="M560 118 v-90" stroke="#3a3f4b" stroke-width="4" /><rect
		x="548"
		y="20"
		width="24"
		height="18"
		rx="4"
		fill={lamp(g.tower)}
	/>
	<path d="M700 198 q-80 -170 -10 -170" stroke="#3a3f4b" stroke-width="4" fill="none" /><circle
		cx="690"
		cy="30"
		r="12"
		fill={lamp(g.arch)}
	/>
	<rect
		x="70"
		y="40"
		width="110"
		height="158"
		rx="4"
		fill="#0b0d12"
		stroke="#2c303b"
		stroke-width="3"
	/>
	<path
		d={g.door ? 'M74 44 L130 58 L130 186 L74 194 Z' : 'M74 44 L176 44 L176 194 L74 194 Z'}
		fill="#1d2029"
		stroke={g.door ? '#ff8a5b' : '#3a3f4b'}
		stroke-width="2"
	/>
	<rect
		x="166"
		y="112"
		width="8"
		height="14"
		rx="2"
		fill={g.lock === undefined ? '#3a3f4b' : g.lock ? '#4fe0a0' : '#ff6b5b'}
	/>
</svg>
