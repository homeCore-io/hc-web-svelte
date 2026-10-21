<!--
	"Do something when this happens" — from an alert, an alert rule, one of
	homeCore's own kinds or a plugin's kind of alert. Choose which alerts
	("For": this device, any like it, broader) and when ("happens", "ends",
	"is still on after N min"); "Make the automation" opens the editor with a
	new automation whose trigger is that, and nothing to do yet.

	The choices are made from the alert's own fields (alertStarts.ts): nothing
	here knows a plugin.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		WHENS,
		startHref,
		startOf,
		type Scope,
		type Start,
		type When
	} from '#lib/alertStarts.js';

	let {
		title,
		scopes,
		tie,
		href,
		onclose
	}: {
		title: string;
		scopes: Scope[];
		tie: Start['tie'];
		/** The alert's place in Settings › Alert rules, for the editor's link back. */
		href: string;
		onclose: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let scope = $state(0);
	let when = $state<When>('raised');
	let minutes = $state(10);
	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
	});

	function make() {
		const s = scopes[scope];
		if (!s) return;
		dialog?.close();
		void goto(startHref(startOf(s, when, Math.max(1, Math.round(minutes || 10)), tie, href)));
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="do-title"
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
	{onclose}
>
	<form
		method="dialog"
		onsubmit={(e) => {
			e.preventDefault();
			make();
		}}
	>
		<header>
			<span class="over">Do something when this happens</span>
			<h2 id="do-title">{title}</h2>
		</header>

		<fieldset>
			<legend>For</legend>
			{#each scopes as s, i (s.id)}
				<label class="scope">
					<input type="radio" name="scope" value={i} bind:group={scope} />
					<span><span class="name">{s.name}</span><span class="help">{s.help}</span></span>
				</label>
			{/each}
		</fieldset>

		<fieldset>
			<legend>When it</legend>
			<div class="seg" role="radiogroup" aria-label="When it">
				{#each WHENS as w (w.id)}
					<button
						type="button"
						role="radio"
						aria-checked={when === w.id}
						onclick={() => (when = w.id)}>{w.name(minutes || 10)}</button
					>
				{/each}
			</div>
			{#if when === 'still'}
				<label class="mins"
					>Still on after
					<input type="number" min="1" max="1440" bind:value={minutes} aria-label="Minutes" />
					min</label
				>
			{/if}
		</fieldset>

		<p class="quiet">
			Opens the automation editor with this already chosen. Telling someone stays with the alert
			itself (Alert rules › Tell); the automation is for everything else.
		</p>

		<div class="buttons">
			<button type="button" class="plain" onclick={() => dialog?.close()}>Cancel</button>
			<button type="submit" class="go" disabled={scopes.length === 0}>Make the automation</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		width: min(440px, calc(100vw - 32px));
		margin: auto;
		padding: 0;
		border: 1px solid var(--card-line);
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	@media (max-width: 599px) {
		dialog {
			width: 100vw;
			max-width: 100vw;
			margin: auto 0 0;
			border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
			max-height: 92vh;
		}
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-5);
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.over {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.3;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	legend {
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.scope {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-height: 44px;
		padding-top: 6px;
		cursor: pointer;
	}
	.scope input {
		width: 18px;
		height: 18px;
		margin: 2px 0 0;
		accent-color: var(--accent);
		flex: none;
	}
	.scope > span {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.name {
		font-size: 15px;
	}
	.help {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.seg {
		display: flex;
		gap: 6px;
		padding: 4px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.seg button {
		flex: 1;
		min-height: 40px;
		padding: 0 8px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
		font-size: 14px;
		line-height: 1.2;
		cursor: pointer;
	}
	.seg button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.mins {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--ink-muted);
	}
	.mins input {
		width: 5em;
		height: 36px;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
		color: var(--ink-muted);
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.buttons button {
		min-height: var(--target);
		padding: 0 18px;
		border-radius: 11px;
		font: inherit;
		font-weight: 600;
	}
	.plain {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go:disabled {
		opacity: 0.5;
	}
</style>
