<!--
	Shows a device's details when the address names one (N5): a sheet that
	slides up on phones and swipes down to close; a centred dialog over the
	dimmed page elsewhere (D3). A native modal dialog, so focus stays inside,
	Escape closes it, and the page behind can't be reached.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { devices } from '#lib/devices.svelte.js';
	import { closeDevice } from '#lib/popup.js';
	import Details from './Details.svelte';
	import { isWled } from '#lib/wled.js';

	const id = $derived(page.url.searchParams.get('device'));
	const device = $derived(id === null ? undefined : devices.byId[id]);

	let dialog = $state<HTMLDialogElement>();
	let returnTo: Element | null = null;

	$effect(() => {
		if (!dialog) return;
		if (id !== null && !dialog.open) {
			returnTo = document.activeElement;
			dialog.showModal();
		} else if (id === null && dialog.open) {
			dialog.close();
			if (returnTo instanceof HTMLElement) returnTo.focus();
		}
	});

	const close = () => closeDevice(page.url);

	// Swipe down to close, on the sheet's grab area.
	let startY: number | null = null;
	let pull = $state(0);
	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;
		startY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (startY !== null) pull = Math.max(0, e.clientY - startY);
	}
	function up() {
		if (startY === null) return;
		startY = null;
		if (pull > 90) close();
		pull = 0;
	}
</script>

<dialog
	bind:this={dialog}
	class:wide={isWled(device)}
	aria-labelledby="details-title"
	style:transform={pull > 0 ? `translateY(${pull}px)` : undefined}
	oncancel={(e) => {
		e.preventDefault();
		close();
	}}
	onclick={(e) => {
		// A click on the backdrop lands on the dialog element itself.
		if (e.target === dialog) close();
	}}
>
	{#if id !== null}
		<div class="sheet">
			<div
				class="grab"
				aria-hidden="true"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
			>
				<span></span>
			</div>
			{#if device}
				<Details {device} onclose={close} />
			{:else if devices.loaded}
				<p class="gone">That device isn't in the house any more.</p>
			{:else}
				<p class="gone">Loading…</p>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		margin: auto 0 0;
		padding: 0;
		width: 100%;
		max-width: 100%;
		max-height: 92dvh;
		border: none;
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
		background: var(--sheet);
		color: var(--ink);
		box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.18);
		overflow: hidden;
	}
	dialog[open] {
		animation: up var(--sheet-in) cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.sheet {
		max-height: 92dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.grab {
		display: flex;
		justify-content: center;
		padding: 10px 0 6px;
		touch-action: none;
	}
	.grab span {
		width: 40px;
		height: 5px;
		border-radius: 3px;
		background: var(--line);
	}
	.gone {
		padding: 8px 20px 28px;
		color: var(--ink-muted);
	}
	@keyframes up {
		from {
			transform: translateY(100%);
		}
	}
	@media (min-width: 700px) {
		dialog {
			margin: auto;
			width: min(520px, 92vw);
		}
		/* A WLED controller's panel: effects beside their controls. */
		dialog.wide {
			width: min(980px, 96vw);
			max-height: 86dvh;
			border-radius: var(--radius-sheet);
			box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		}
		dialog[open] {
			animation: fade var(--sheet-in) ease-out;
		}
		.sheet {
			max-height: 86dvh;
			padding-top: 12px;
		}
		.grab {
			display: none;
		}
		@keyframes fade {
			from {
				opacity: 0;
				transform: scale(0.97);
			}
		}
	}
</style>
