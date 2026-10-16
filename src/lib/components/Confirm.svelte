<!--
	The in-page confirmation (08 §3), shown for whatever `ask` is asking. A
	modal <dialog>: focus stays in it, Escape is "no", and the page behind is
	still the page — no browser dialog.
-->
<script lang="ts">
	import { asking } from '#lib/confirm.svelte.js';

	let dialog = $state<HTMLDialogElement | null>(null);
	let typed = $state('');
	const q = $derived(asking.current);
	const ready = $derived(
		q?.typed === undefined || typed.trim().toLowerCase() === q.typed.toLowerCase()
	);

	$effect(() => {
		if (!dialog) return;
		if (q && !dialog.open) {
			typed = '';
			dialog.showModal();
		} else if (!q && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	role="alertdialog"
	aria-labelledby="confirm-title"
	oncancel={(e) => {
		e.preventDefault();
		asking.answer(false);
	}}
>
	{#if q}
		<form
			method="dialog"
			onsubmit={(e) => {
				e.preventDefault();
				if (ready) asking.answer(true);
			}}
		>
			<h2 id="confirm-title">{q.title}</h2>
			{#if q.body}<p>{q.body}</p>{/if}
			{#if q.lost?.length}
				<ul>
					{#each q.lost as line, i (i)}<li>{line}</li>{/each}
				</ul>
			{/if}
			{#if q.typed !== undefined}
				<label class="typed">
					<span>Type <code>{q.typed}</code> to confirm</span>
					<input bind:value={typed} autocomplete="off" spellcheck="false" />
				</label>
			{/if}
			<div class="buttons">
				<button type="button" class="stay" onclick={() => asking.answer(false)}
					>{q.stay ?? 'Cancel'}</button
				>
				<!-- svelte-ignore a11y_autofocus -->
				<button
					type="submit"
					class="go"
					class:danger={q.danger}
					disabled={!ready}
					autofocus={q.typed === undefined && !q.danger}>{q.go}</button
				>
			</div>
		</form>
	{/if}
</dialog>

<style>
	dialog {
		width: min(480px, calc(100vw - 32px));
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
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
	}
	h2 {
		margin: 0;
		font-size: 20px;
		line-height: 1.3;
	}
	p,
	ul {
		margin: 0;
		line-height: 1.5;
	}
	ul {
		padding-left: 1.2em;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.typed {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	code {
		font-family: var(--font-num);
	}
	input {
		height: 44px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	button {
		height: var(--target);
		padding: 0 18px;
		border-radius: 22px;
		font: inherit;
		font-weight: 700;
	}
	.stay {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go.danger {
		background: var(--alert);
		color: var(--alert-ink);
	}
	.go:disabled {
		opacity: 0.4;
	}
</style>
