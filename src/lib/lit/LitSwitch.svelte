<!--
	A switch in the Lit look (12): a rocker that lights when it's on, amber
	for a light, orange for something it powers (a heater, a plug, a valve).
-->
<script lang="ts">
	import { commands } from '#lib/commands.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { session } from '#lib/me.svelte.js';
	import type { Lamp } from './room.js';

	let { l, power = false }: { l: Lamp; power?: boolean } = $props();

	async function flip() {
		const d = l.card.device;
		if (!(await goAhead(d.device_id, l.view.kind, `Turn ${l.name} ${l.on ? 'off' : 'on'}?`)))
			return;
		void commands.set(d.device_id, l.view.kind, { [l.attr]: !l.on }, d.attributes);
	}
</script>

<button
	class="rocker"
	class:on={l.on}
	class:power
	aria-pressed={l.on}
	disabled={!session.mayUse || !l.view.available}
	onclick={flip}
>
	<span class="plate" aria-hidden="true"><span class="paddle"></span></span>
	<span class="name">{l.name}</span>
	<span class="sub">{l.view.available ? (l.on ? 'On' : 'Off') : 'Not answering'}</span>
</button>

<style>
	.rocker {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 10px 6px 8px;
		box-sizing: border-box;
		border-radius: 14px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.rocker.on {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface));
	}
	.plate {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		width: 28px;
		height: 44px;
		padding: 3px;
		box-sizing: border-box;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--bg);
	}
	.on .plate {
		justify-content: flex-start;
	}
	.paddle {
		height: 20px;
		border-radius: 5px;
		background: var(--surface-2);
	}
	.on .paddle {
		background: var(--accent);
		box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.on.power .paddle {
		background: #ff9b5c;
		box-shadow: 0 0 12px rgba(255, 155, 92, 0.7);
	}
	.name {
		font-size: 13px;
		font-weight: 600;
		text-align: center;
		line-height: 1.2;
	}
	.sub {
		font-size: 11px;
		color: var(--ink-muted);
	}
	@media (max-width: 599px) {
		.rocker {
			gap: 6px;
			padding: 10px 4px 8px;
		}
		.plate {
			width: 28px;
			height: 44px;
		}
		.paddle {
			height: 20px;
		}
		.name {
			font-size: 12px;
		}
	}
</style>
