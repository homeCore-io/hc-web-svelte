<!-- The Family Room board's drawing: a ceiling fan with its light, a floor lamp, a small lamp, a desk lamp and holiday lights. -->
<script lang="ts">
	import { op, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
	const COLORS = ['#ff5a7a', '#4fe0a0', '#ffc46b', '#7fb8ff'];
	const bulbs = Array.from({ length: 14 }, (_, i) => ({
		x: 260 + i * 50,
		y: 6 + (i % 2) * 6,
		c: COLORS[i % 4]
	}));
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
		<radialGradient id="{u}h"
			><stop offset="0" stop-color="#ff5a7a" stop-opacity=".7" /><stop
				offset=".5"
				stop-color="#4fe0a0"
				stop-opacity=".35"
			/><stop offset="1" stop-color="#4fe0a0" stop-opacity="0" /></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" />
	<rect x="0" y="196" width="1000" height="54" fill="#12141b" />
	<ellipse cx="700" cy="20" rx="300" ry="170" fill="url(#{u}c)" opacity={op(g.over)} />
	<ellipse cx="470" cy="70" rx="160" ry="150" fill="url(#{u}w)" opacity={op(g.floor)} />
	<ellipse cx="830" cy="150" rx="120" ry="100" fill="url(#{u}w)" opacity={op(g.small)} />
	<ellipse cx="960" cy="120" rx="110" ry="100" fill="url(#{u}w)" opacity={op(g.desk)} />
	<ellipse cx="600" cy="10" rx="420" ry="40" fill="url(#{u}h)" opacity={g.hol ? 0.8 : 0} />
	{#each bulbs as b (b.x)}<circle
			cx={b.x}
			cy={b.y}
			r="3"
			fill={b.c}
			opacity={g.hol ? 1 : 0.15}
		/>{/each}
	<rect x="690" y="0" width="20" height="26" fill="#2a2e38" />
	<g class="blades" class:spin={!!g.fan}>
		<rect x="560" y="26" width="140" height="7" rx="3.5" fill="#3a3f4b" />
		<rect x="700" y="26" width="140" height="7" rx="3.5" fill="#3a3f4b" />
	</g>
	<ellipse cx="700" cy="36" rx="22" ry="10" fill="#4a4f5c" />
	<path d="M680 42 a20 16 0 0 0 40 0 z" fill={g.over ? '#fff1d6' : '#2c303b'} />
	<ellipse cx="700" cy="50" rx="34" ry="10" fill="#fff4dc" opacity={op(g.over)} />
	<path d="M478 196 v-140" stroke="#3a3f4b" stroke-width="5" />
	<path d="M450 58 h56 l-10 -26 h-36 z" fill={lamp(g.floor)} />
	<rect x="560" y="132" width="230" height="64" rx="18" fill="#1d2029" />
	<rect x="548" y="118" width="254" height="34" rx="16" fill="#252934" />
	<rect x="800" y="160" width="60" height="36" rx="4" fill="#1b1e26" />
	<path d="M830 160 v-18" stroke="#3a3f4b" stroke-width="4" /><path
		d="M814 142 h32 l-6 -18 h-20 z"
		fill={lamp(g.small)}
	/>
	<rect x="900" y="150" width="100" height="8" rx="3" fill="#2a2e38" />
	<path
		d="M950 150 l0 -32 l22 -12"
		stroke="#3a3f4b"
		stroke-width="4"
		fill="none"
		stroke-linecap="round"
	/><path d="M966 100 l24 10 l-10 14 z" fill={lamp(g.desk)} />
</svg>

<style>
	.blades {
		transform-box: fill-box;
		transform-origin: center;
	}
	.spin {
		animation: spin 1.6s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
