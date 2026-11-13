<!--
	A frosted glass sheet up from the bottom of the phone (the PhonePlan
	board): a lamp's, the person's own settings, a room's "⋯". A native modal
	dialog, so the keyboard stays inside it and the page behind can't be
	reached; Escape, the ✕ or pulling it down by its top closes it, and the
	keyboard goes back to what opened it.

	It takes a place in the browser's history as it opens, so Back (the
	browser's, or Android's gesture) closes it rather than leaving the page.
-->
<script module lang="ts">
	let made = 0;
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { pushState, replaceState } from '$app/navigation';
	import X from '@lucide/svelte/icons/x';
	import { pullCloses } from './phone.js';

	let {
		label,
		onclose,
		head,
		children
	}: {
		/** The sheet's name, for its title and for screen readers. */
		label: string;
		onclose: () => void;
		/** Beside the title: a tag, a word on how it is. */
		head?: Snippet;
		children: Snippet;
	} = $props();

	// ---- its place in history: Back closes it, and closing it takes the place back ----
	const key = ++made;
	let placed = false;
	let leaving = false;
	onMount(() => {
		pushState('', { ...page.state, phoneSheet: key });
		// Closed by its page, not from the sheet (on its way to a device's
		// details, say): its place is let go of where it is, as going back
		// now would race whatever opens next.
		return () => {
			if (placed && !leaving && page.state.phoneSheet === key) {
				const { phoneSheet: _, ...rest } = page.state;
				replaceState('', rest);
			}
		};
	});
	// Its place shown; then Back was pressed, or the page moved on: the sheet goes.
	$effect(() => {
		const here = page.state.phoneSheet === key;
		if (here) placed = true;
		else if (placed) {
			placed = false;
			onclose();
		}
	});
	/** Closed from the sheet: by going back, when its place is still the one shown. */
	function close() {
		if (leaving) return;
		if (placed && page.state.phoneSheet === key) {
			leaving = true;
			history.back();
		} else onclose();
	}

	let dialog = $state<HTMLDialogElement>();
	onMount(() => {
		const from = document.activeElement;
		dialog?.showModal();
		return () => {
			if (dialog?.open) dialog.close();
			if (from instanceof HTMLElement && from.isConnected) from.focus();
		};
	});

	// ---- pulled down by its top, it follows the finger and closes past a point ----
	let start: { y: number; t: number } | null = null;
	let pull = $state(0);
	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return;
		start = { y: e.clientY, t: e.timeStamp };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (start) pull = Math.max(0, e.clientY - start.y);
	}
	function up(e: PointerEvent) {
		if (!start) return;
		const speed = pull / Math.max(1, e.timeStamp - start.t);
		start = null;
		if (pullCloses(pull, speed)) close();
		pull = 0;
	}
</script>

<dialog
	bind:this={dialog}
	class="psheet"
	aria-label={label}
	style:transform={pull > 0 ? `translateY(${pull}px)` : undefined}
	oncancel={(e) => {
		e.preventDefault();
		close();
	}}
	onclick={(e) => {
		// A tap on the dimmed page lands on the dialog element itself.
		if (e.target === dialog) close();
	}}
>
	<div class="glass">
		<div
			class="top"
			role="presentation"
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			<span class="grab" aria-hidden="true"></span>
			<div class="ttl">
				<h2>{label}</h2>
				{#if head}{@render head()}{/if}
				<button type="button" class="x" aria-label="Close" onclick={close}
					><X size={18} strokeWidth={2.2} aria-hidden="true" /></button
				>
			</div>
		</div>
		<div class="body">{@render children()}</div>
	</div>
</dialog>

<style>
	.psheet {
		margin: auto 0 0;
		padding: 0;
		width: 100%;
		max-width: 100%;
		max-height: 88dvh;
		border: 0;
		background: transparent;
		color: var(--ink);
		overflow: visible;
	}
	.psheet::backdrop {
		background: rgba(3, 4, 7, 0.45);
	}
	/* The glass is drawn behind, so a picker inside is placed by the window, not by it. */
	.glass {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		max-height: 88dvh;
		border-radius: 28px 28px 0 0;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.glass::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		backdrop-filter: blur(40px) saturate(1.4);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			0 -20px 50px rgba(0, 0, 0, 0.5);
	}
	/* Without blur, what is behind would read through the sheet, so it is nearly solid. */
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.glass::before {
			background: color-mix(in srgb, var(--surface) 96%, transparent);
		}
	}
	.top {
		flex: none;
		padding: 10px 20px 0;
		touch-action: none;
	}
	.grab {
		display: block;
		width: 40px;
		height: 5px;
		margin: 0 auto 10px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--ink) 25%, transparent);
	}
	.ttl {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	h2 {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
	.x {
		position: relative;
		flex: none;
		margin-left: auto;
		width: 44px;
		height: 44px;
		margin-right: -6px;
		border: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--ink);
	}
	.x::before {
		content: '';
		position: absolute;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.x :global(svg) {
		position: relative;
	}
	.body {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 4px 20px 24px;
	}
	@media (prefers-reduced-motion: no-preference) {
		.psheet[open] {
			animation: up 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
		}
		@keyframes up {
			from {
				transform: translateY(100%);
			}
		}
	}
</style>
