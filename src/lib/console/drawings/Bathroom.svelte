<!-- The bathroom drawing (RoomPictures): a glass shower, the vanity with its oval mirror and the light over it, a toilet, a towel and the tub, under a ceiling light. -->
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
		<linearGradient id="{u}m" x1="0" x2="1" y1="0" y2="1"
			><stop offset="0" stop-color="#2a3442" /><stop offset=".5" stop-color="#1a212c" /><stop
				offset="1"
				stop-color="#232c38"
			/></linearGradient
		>
		<clipPath id="{u}o"><ellipse cx="530" cy="106" rx="46" ry="30" /></clipPath>
	</defs>
	<rect width="1000" height="250" fill="#0e1016" />
	<!-- Tiles on the wall, and the floor -->
	<g stroke="#151820"
		><path
			d="M0 80h1000M0 120h1000M0 160h1000M60 80v120M140 80v120M380 80v120M460 80v120M700 80v120M780 80v120M860 80v120"
		/></g
	>
	<rect y="200" width="1000" height="50" fill="#14171e" /><path d="M0 200h1000" stroke="#22262f" />

	<!-- The ceiling light -->
	<ellipse cx="560" cy="0" rx="260" ry="130" fill="url(#{u}c)" opacity={op(g.ceil)} /><circle
		cx="560"
		cy="8"
		r="16"
		fill={shade(g.ceil)}
	/>

	<!-- A glass shower: a frame, its sheen, the head and the water -->
	<rect
		x="40"
		y="52"
		width="170"
		height="148"
		rx="4"
		fill="#111823"
		stroke="#3a4250"
		stroke-width="3"
	/>
	<path d="M70 190l60-120M100 196l58-116" stroke="#2b3646" stroke-width="6" opacity=".55" />
	<path d="M180 52v26h-26" stroke="#5a606c" stroke-width="4" fill="none" />
	<ellipse cx="150" cy="80" rx="12" ry="4" fill="#5a606c" />
	<g stroke="#3d5674" stroke-width="2" stroke-linecap="round"
		><path d="M142 92l-4 18M150 94v20M158 92l4 18M146 122l-3 14M155 124l3 14" /></g
	>

	<!-- The light over the mirror: three globes on a bar, and their wash -->
	<rect x="460" y="54" width="140" height="6" rx="3" fill="#3a3f4b" />
	<rect x="420" y="60" width="220" height="96" fill="url(#{u}v)" opacity={op(g.vanity)} />
	<circle cx="485" cy="63" r="8" fill={shade(g.vanity)} /><circle
		cx="530"
		cy="63"
		r="8"
		fill={shade(g.vanity)}
	/><circle cx="575" cy="63" r="8" fill={shade(g.vanity)} />

	<!-- The oval mirror: a silver frame and the shine across the glass -->
	<ellipse cx="530" cy="106" rx="50" ry="34" fill="#9aa3b2" />
	<ellipse cx="530" cy="106" rx="46" ry="30" fill="url(#{u}m)" />
	<g clip-path="url(#{u}o)" stroke="#d9e2ee" stroke-linecap="round"
		><path d="M496 124l38-42" stroke-width="7" opacity=".22" /><path
			d="M514 130l30-38"
			stroke-width="3"
			opacity=".18"
		/></g
	>

	<!-- The sink: a counter, the basin, the faucet, and the cabinet under it -->
	<rect x="440" y="150" width="180" height="12" rx="3" fill="#323743" />
	<path d="M500 150q30 14 60 0" fill="#0d0f14" />
	<path
		d="M530 150v-5q0-4 6-4h5"
		stroke="#9aa3b2"
		stroke-width="4"
		fill="none"
		stroke-linecap="round"
	/>
	<rect x="448" y="162" width="164" height="38" fill="#1b1e26" />
	<path d="M530 164v34" stroke="#262a34" stroke-width="2" />
	<circle cx="522" cy="181" r="2.5" fill="#5a606c" /><circle
		cx="538"
		cy="181"
		r="2.5"
		fill="#5a606c"
	/>

	<!-- A towel on its bar beside the vanity -->
	<path d="M388 96h40" stroke="#5a606c" stroke-width="3" stroke-linecap="round" />
	<path d="M392 97h32v46q-16 6-32 0z" fill="#2c3a4c" /><path
		d="M392 132q16 6 32 0"
		stroke="#3b4c62"
		stroke-width="3"
		fill="none"
	/>

	<!-- The toilet: tank, seat and bowl -->
	<rect x="668" y="120" width="56" height="40" rx="6" fill="#2a2e38" stroke="#3a3f4b" />
	<rect x="662" y="158" width="76" height="8" rx="4" fill="#323743" />
	<path d="M666 166h68q-4 24-24 30h-20q-20-6-24-30z" fill="#2a2e38" />
	<rect x="682" y="194" width="36" height="6" fill="#20232c" />

	<!-- The tub, with its faucet -->
	<rect x="770" y="140" width="210" height="60" rx="26" fill="#20232c" stroke="#2c303b" />
	<path d="M786 146h178" stroke="#363b47" stroke-width="3" stroke-linecap="round" />
	<path d="M960 140v-46h-24" stroke="#5a606c" stroke-width="4" fill="none" />
</svg>
