<!--
	A level as a wide bar you drag (the details mockup's brightness bar): easy
	to hit on a phone, and the fill says the value at a glance. A real range
	input lies over it, so keyboards and screen readers get a slider. Sends
	once, on release.
-->
<script lang="ts">
	let {
		label,
		value,
		min,
		max,
		step = 1,
		unit,
		disabled = false,
		oncommit
	}: {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		unit?: string;
		disabled?: boolean;
		oncommit: (value: number) => void;
	} = $props();

	let held = $state<number | null>(null);
	const shown = $derived(held ?? value);
	const pct = $derived(max > min ? ((shown - min) / (max - min)) * 100 : 0);
	const text = $derived(
		unit === 'K'
			? `${Math.round(shown)} K`
			: `${Number.isInteger(step) ? Math.round(shown) : shown.toFixed(1)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`
	);
</script>

<div class="bar" class:disabled>
	<div class="fill" style:width={`${Math.max(0, Math.min(100, pct))}%`}></div>
	<div class="words" aria-hidden="true">
		<span>{label}</span>
		<span class="num">{text}</span>
	</div>
	<input
		type="range"
		{min}
		{max}
		{step}
		value={shown}
		{disabled}
		aria-label={label}
		aria-valuetext={text}
		oninput={(e) => (held = Number(e.currentTarget.value))}
		onchange={(e) => {
			const v = Number(e.currentTarget.value);
			held = null;
			oncommit(v);
		}}
	/>
</div>

<style>
	.bar {
		position: relative;
		height: 56px;
		border-radius: var(--radius);
		background: var(--surface-2);
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--fill);
	}
	.words {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		font-size: 15px;
		font-weight: 600;
		pointer-events: none;
	}
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.bar:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.disabled {
		opacity: 0.5;
	}
	.disabled input {
		cursor: default;
	}
</style>
