<!--
	A room over Home (13 §7, G1, Bubble's pop-ups): the room as its page
	draws it, from the side on a wide screen and from the bottom on a phone.
	It is only looked at and used here; its page, where it's arranged, is a
	tap away. Escape, ✕, a tap outside and Back all close it (G2): it was
	opened as a step in the history, so closing it is going back.
-->
<script lang="ts">
	import { rooms } from '#lib/rooms.svelte.js';
	import { markSheet } from '#lib/heading.svelte.js';
	import RoomView from './RoomView.svelte';

	let { id, close }: { id: string; close: () => void } = $props();
	markSheet();

	const name = $derived(id === 'none' ? 'No room' : rooms.list.find((r) => r.id === id)?.name);
	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
	});
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	aria-label={name ?? 'A room'}
	oncancel={(e) => {
		e.preventDefault();
		close();
	}}
	onclick={(e) => {
		// The backdrop is the dialog itself; its content is inside .box.
		if (e.target === dialog) close();
	}}
>
	<div class="box">
		<div class="top">
			<a class="page" href={`/rooms/${id}`}>Open {name ?? 'the room'}'s page ›</a>
			<button class="close" aria-label="Close" onclick={close}>✕</button>
		</div>
		<RoomView {id} />
	</div>
</dialog>

<style>
	.sheet {
		position: fixed;
		inset: 12px 12px 12px auto;
		width: min(560px, calc(100vw - 24px));
		max-width: none;
		height: auto;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 22px;
		background: var(--bg);
		color: var(--ink);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
		animation: in-side 0.22s ease-out;
	}
	.sheet::backdrop {
		background: var(--scrim);
	}
	.box {
		height: 100%;
		overflow: auto;
		padding: 12px 16px 24px;
		box-sizing: border-box;
	}
	.top {
		position: sticky;
		top: -12px;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin: -12px -16px 10px;
		padding: 10px 16px;
		background: var(--bg);
	}
	.page {
		color: var(--accent);
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
	}
	.close {
		width: 34px;
		height: 34px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink-muted);
	}
	/* On a phone, from the bottom, most of the screen tall. */
	@media (max-width: 699px) {
		.sheet {
			inset: auto 0 0 0;
			width: 100vw;
			height: 88dvh;
			border-radius: 22px 22px 0 0;
			animation: in-up 0.22s ease-out;
		}
	}
	@keyframes in-side {
		from {
			transform: translateX(24px);
			opacity: 0.5;
		}
	}
	@keyframes in-up {
		from {
			transform: translateY(30%);
			opacity: 0.5;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet {
			animation: none;
		}
	}
</style>
