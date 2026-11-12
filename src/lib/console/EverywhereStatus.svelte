<!--
	An Everywhere view's word in the sidebar (the Everywhere board): "3 rooms",
	"1 playing", "secure", with a light while its lights are on, something
	plays, a door is open or a sensor finds water. On the folded rail, the
	light alone.
-->
<script lang="ts">
	import type { ViewStatus } from './everywhere.js';

	let { status }: { status: ViewStatus } = $props();
	const lit = $derived(status.tone !== undefined && status.tone !== 'ok');
</script>

<span class="st" class:warn={status.tone === 'warn'}>
	{#if lit}<i class={status.tone} aria-hidden="true"></i>{/if}
	<span class="w">{status.word}</span>
</span>

<style>
	.st {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-num);
		font-size: 11.5px;
		font-weight: 400;
		color: var(--ink-muted);
		white-space: nowrap;
	}
	.st.warn {
		color: var(--alert);
		font-weight: 600;
	}
	i {
		width: 7px;
		height: 7px;
		flex: none;
		border-radius: 50%;
	}
	i.on {
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	i.media {
		background: #a07bff;
		box-shadow: 0 0 8px #a07bff;
	}
	i.warn {
		background: var(--alert);
		box-shadow: 0 0 8px var(--alert);
	}
	i.wet {
		background: #3a8cff;
		box-shadow: 0 0 8px #3a8cff;
	}
	/* The folded rail and a narrow screen: the light alone, in the icon's corner. */
	:global(.folded) .w {
		display: none;
	}
	:global(.folded) i {
		position: absolute;
		top: 8px;
		right: 8px;
	}
	@media (max-width: 760px) {
		.w {
			display: none;
		}
		i {
			position: absolute;
			top: 8px;
			right: 8px;
		}
	}
</style>
