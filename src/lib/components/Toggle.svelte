<!--
	An on/off switch: a 44px target around a 46×28 track (06 — V1).
-->
<script lang="ts">
	let {
		on,
		label,
		disabled = false,
		onchange
	}: { on: boolean; label: string; disabled?: boolean; onchange: (on: boolean) => void } = $props();
</script>

<button
	class="toggle"
	role="switch"
	aria-checked={on}
	aria-label={label}
	{disabled}
	onclick={() => onchange(!on)}
>
	<span class="track" class:on><span class="knob"></span></span>
</button>

<style>
	.toggle {
		position: relative;
		z-index: 2;
		width: 54px;
		height: var(--target);
		margin: -8px -6px 0 0;
		border: none;
		background: none;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}
	.toggle:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.track {
		position: relative;
		display: block;
		width: 46px;
		height: 28px;
		border-radius: 14px;
		background: var(--track-off);
		transition: background var(--quick);
	}
	.track.on {
		background: var(--track-on);
	}
	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 11px;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		transition: left var(--quick);
	}
	.on .knob {
		left: 21px;
	}
</style>
