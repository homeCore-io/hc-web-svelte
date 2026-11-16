<!--
	The Ask button (`app.assistant`): in the top bar of every page, while a
	running plugin offers the house's assistant. Opens and closes its panel,
	or on a phone, goes to its page. Drawn to suit the frame it sits in.
-->
<script lang="ts">
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import { pluginUis } from './uis.svelte.js';
	import { assistant } from './assistant.svelte.js';

	let {
		variant = 'shell'
	}: {
		/** The standard frame's header, the console's toolbar, a phone page's top, or over a room's picture. */
		variant?: 'shell' | 'console' | 'phone' | 'hero';
	} = $props();

	pluginUis.ensure();
</script>

{#if assistant.offer}
	<button
		type="button"
		class="ask {variant}"
		data-ask-button
		aria-controls={assistant.open ? 'hc-ask' : undefined}
		aria-expanded={assistant.open}
		title={assistant.label}
		onclick={(e) => assistant.toggle(e.currentTarget)}
	>
		<MessageCircle size={variant === 'console' ? 16 : 18} strokeWidth={2} aria-hidden="true" />
		<span class="word">{assistant.label}</span>
	</button>
{/if}

<style>
	.ask {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: 0;
		font: inherit;
		font-weight: 700;
		white-space: nowrap;
		cursor: pointer;
	}
	.ask[aria-expanded='true'] {
		background: var(--accent);
		color: var(--accent-ink);
	}

	/* The standard frame: a pill beside Search and Alerts. */
	.shell {
		height: 40px;
		padding: 0 14px 0 11px;
		margin-right: var(--space-1);
		border-radius: 20px;
		background: var(--surface-2);
		color: var(--ink);
		font-size: 15px;
	}
	.shell:hover:not([aria-expanded='true']) {
		background: var(--nav-on);
	}

	/* The console's toolbar, as its other buttons. */
	.console {
		height: 32px;
		padding: 0 11px 0 9px;
		border-radius: 9px;
		background: var(--con-raise);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
	}
	.console:hover:not([aria-expanded='true']) {
		background: var(--con-hover);
	}

	/* A phone page's top: a finger high, beside the person's picture. */
	.phone {
		height: 44px;
		padding: 0 14px 0 11px;
		border-radius: 22px;
		background: var(--con-raise, var(--nav-on));
		color: var(--ink);
		font-size: 15px;
	}

	/* Over a room's picture, as the round buttons there. */
	.hero {
		height: 44px;
		padding: 0 14px 0 11px;
		border-radius: 22px;
		background: rgba(10, 12, 16, 0.55);
		backdrop-filter: blur(10px);
		color: #fff;
		font-size: 15px;
	}
</style>
