<!--
	Unsaved changes, and the way out of them: what's changed, Discard, Save.
	Sits above the phone bar; on a desk, at the foot of the window.
-->
<script lang="ts">
	let {
		count,
		summary,
		saving = false,
		blocked = null,
		save,
		discard,
		saveLabel = 'Save'
	}: {
		count: number;
		summary: string;
		saving?: boolean;
		/** Why it can't be saved yet, if it can't. */
		blocked?: string | null;
		save: () => void;
		discard: () => void;
		saveLabel?: string;
	} = $props();
</script>

<div class="bar" role="region" aria-label="Unsaved changes">
	<span class="what">
		<strong>{count === 1 ? 'One change' : `${count} changes`}</strong>
		<span class="summary">{blocked ?? summary}</span>
	</span>
	<button class="discard" type="button" onclick={discard} disabled={saving}>Discard</button>
	<button class="save" type="button" onclick={save} disabled={saving || blocked !== null}
		>{saving ? 'Saving…' : saveLabel}</button
	>
</div>

<style>
	.bar {
		position: sticky;
		bottom: calc(72px + env(safe-area-inset-bottom));
		z-index: 3;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--ink);
		color: var(--bg);
		box-shadow: var(--shadow);
	}
	@media (min-width: 700px) and (orientation: landscape), (min-width: 1100px) {
		.bar {
			bottom: var(--space-4);
		}
	}
	.what {
		flex: 1 1 200px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.summary {
		font-size: 13px;
		opacity: 0.8;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	button {
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		font: inherit;
		font-weight: 700;
	}
	.discard {
		border: 1px solid color-mix(in srgb, var(--bg) 40%, transparent);
		background: none;
		color: var(--bg);
	}
	.save {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	button:disabled {
		opacity: 0.5;
	}
</style>
