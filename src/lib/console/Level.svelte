<!--
	A slim level across, for a volume (the FamilyRoom and Office boards'
	speakers and room audio): a lit bar over a dim track. A real range input
	lies over it, so keyboards and screen readers get a slider; it follows the
	pointer and sends once, on release, as the faders do.
-->
<script lang="ts">
	let {
		label,
		value,
		min = 0,
		max = 100,
		muted = false,
		disabled = false,
		waiting = false,
		width,
		oncommit
	}: {
		/** The slider's name: "Office-1 volume". */
		label: string;
		value: number;
		min?: number;
		max?: number;
		/** Drawn grey: it's at this level, but silent. */
		muted?: boolean;
		disabled?: boolean;
		/** A command is on its way. */
		waiting?: boolean;
		/** Its width in pixels; else it fills its place. */
		width?: number;
		oncommit: (value: number) => void;
	} = $props();

	let held = $state<number | null>(null);
	const shown = $derived(held ?? value);
	const p = $derived(max > min ? Math.max(0, Math.min(1, (shown - min) / (max - min))) : 0);

	function done() {
		if (held === null) return;
		const v = held;
		held = null;
		if (v !== value) oncommit(v);
	}
</script>

<span
	class="lvl"
	class:muted
	class:waiting
	class:disabled
	style:width={width ? `${width}px` : undefined}
	style:--p={`${p * 100}%`}
>
	<i></i>
	<input
		type="range"
		{min}
		{max}
		step="1"
		value={shown}
		{disabled}
		aria-label={label}
		aria-valuetext={muted ? `${Math.round(shown)}, muted` : String(Math.round(shown))}
		oninput={(e) => (held = Number(e.currentTarget.value))}
		onchange={done}
		onpointerup={done}
		onkeyup={done}
		onblur={done}
	/>
</span>

<style>
	.lvl {
		position: relative;
		display: block;
		flex: 1 1 auto;
		min-width: 60px;
		height: 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--ink) 14%, transparent);
	}
	.lvl i {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: var(--p);
		border-radius: 4px;
		background: var(--ink);
		box-shadow: 0 0 10px color-mix(in srgb, var(--ink) 35%, transparent);
		transition: width 0.12s;
	}
	.lvl.muted i {
		background: #6b7280;
		box-shadow: none;
	}
	.lvl.waiting i {
		opacity: 0.6;
	}
	.lvl.disabled {
		opacity: 0.4;
	}
	input {
		position: absolute;
		inset: -10px 0;
		width: 100%;
		height: calc(100% + 20px);
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	input:disabled {
		cursor: default;
	}
	.lvl:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
	}
	@media (prefers-reduced-motion: reduce) {
		.lvl i {
			transition: none;
		}
	}
</style>
