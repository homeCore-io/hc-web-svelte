<!--
	The house's modes as chips (D10): each is a control, lit while on.
-->
<script lang="ts">
	import { kindOf } from '#lib/card.js';
	import { session } from '#lib/me.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import Icon from './Icon.svelte';

	const modes = $derived(
		Object.values(devices.byId)
			.filter((d) => kindOf(d) === 'mode')
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
</script>

{#if modes.length > 0}
	<div class="modes">
		{#each modes as m (m.device_id)}
			{@const on = (commands.pending[m.device_id]?.want.on ?? m.attributes.on) === true}
			<button
				class="mode"
				aria-pressed={on}
				disabled={!m.available || !m.schema?.attributes.on?.writable || !session.mayUse}
				onclick={() => commands.set(m.device_id, 'mode', { on: !on }, m.attributes)}
			>
				<Icon name="mode" size={16} />
				{displayName(m)}
			</button>
		{/each}
	</div>
{/if}

<style>
	.modes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.mode {
		display: flex;
		align-items: center;
		gap: 6px;
		height: var(--target);
		padding: 0 14px 0 12px;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 14px;
		font-weight: 600;
	}
	.mode[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.mode:disabled {
		opacity: 0.5;
	}
</style>
