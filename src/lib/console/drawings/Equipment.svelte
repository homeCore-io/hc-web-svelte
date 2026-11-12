<!-- The equipment room drawing (RoomPictures): a ceiling light, a rack whose lights blink, a panel and a water heater. -->
<script lang="ts">
	import { op, shade, type Glow } from '../pictures.js';

	let { g }: { g: Glow } = $props();
	const u = $props.id();
	const RACK = [0, 1, 2, 3, 4, 5, 6];
</script>

<svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<radialGradient id="{u}c"
			><stop offset="0" stop-color="#e8f3ff" stop-opacity=".8" /><stop
				offset="1"
				stop-color="#cfe3ff"
				stop-opacity="0"
			/></radialGradient
		>
	</defs>
	<rect width="1000" height="250" fill="#0c0e13" /><rect
		y="206"
		width="1000"
		height="44"
		fill="#121419"
	/>
	<ellipse cx="500" cy="0" rx="380" ry="150" fill="url(#{u}c)" opacity={op(g.ceil)} /><rect
		x="380"
		y="0"
		width="240"
		height="8"
		rx="3"
		fill={shade(g.ceil)}
	/>
	<rect
		x="300"
		y="40"
		width="170"
		height="166"
		rx="6"
		fill="#16191f"
		stroke="#2c303b"
		stroke-width="3"
	/>
	{#each RACK as i (i)}<rect
			x="312"
			y={52 + i * 21}
			width="146"
			height="16"
			rx="2"
			fill="#20242c"
		/><circle
			class="blink"
			style:animation-delay="{i * -0.7}s"
			cx="324"
			cy={60 + i * 21}
			r="2.5"
			fill="#4fe0a0"
		/><circle
			class="blink slow"
			style:animation-delay="{i * -0.5}s"
			cx="334"
			cy={60 + i * 21}
			r="2.5"
			fill="#5ab8ff"
		/>{/each}
	<rect x="560" y="50" width="120" height="150" rx="4" fill="#1b1e26" stroke="#2c303b" /><path
		d="M576 70h88M576 90h88M576 110h88M576 130h88M576 150h88"
		stroke="#2a2e38"
		stroke-width="6"
	/>
	<rect x="760" y="80" width="150" height="120" rx="60" fill="#1d2029" stroke="#2c303b" /><path
		d="M835 80v-40h40"
		stroke="#3a3f4b"
		stroke-width="6"
		fill="none"
	/>
</svg>

<style>
	.blink {
		animation: blink 2.1s steps(1) infinite;
	}
	.blink.slow {
		animation-duration: 1.4s;
	}
	@keyframes blink {
		50% {
			opacity: 0.2;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.blink {
			animation: none;
		}
	}
</style>
