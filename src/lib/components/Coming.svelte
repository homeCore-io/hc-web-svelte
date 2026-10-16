<!--
	A page that exists in the frame but not yet in the app: says what it will
	be and when, rather than being empty.
-->
<script lang="ts">
	let { what, when }: { what: string; when: string } = $props();
</script>

<section>
	<p>{what}</p>
	<p class="when">Arrives in {when}.</p>
</section>

<style>
	section {
		max-width: 520px;
		margin-top: var(--space-4);
		padding: var(--space-5);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		box-shadow: var(--shadow);
	}
	p {
		margin: 0;
		font-size: 15px;
		line-height: 1.45;
	}
	.when {
		margin-top: var(--space-2);
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
