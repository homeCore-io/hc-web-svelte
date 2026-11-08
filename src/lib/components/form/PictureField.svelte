<!--
	A picture for a Picture widget (14 §6): chosen from this device, sent to
	the app's own server, kept as its address there. Shown as it is now.
-->
<script lang="ts">
	let {
		value,
		id,
		disabled = false,
		onchange
	}: {
		value: unknown;
		id: string;
		disabled?: boolean;
		onchange: (v: unknown) => void;
	} = $props();

	const src = $derived(typeof value === 'string' ? value : '');
	let busy = $state(false);
	let problem = $state('');
	let input = $state<HTMLInputElement>();

	async function send(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		problem = '';
		busy = true;
		try {
			const res = await fetch('/ui/pictures', {
				method: 'POST',
				headers: { 'content-type': file.type || 'application/octet-stream' },
				body: file
			});
			const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
			if (res.ok && body.url) onchange(body.url);
			else problem = body.error ?? 'It couldn’t be sent.';
		} catch {
			problem = 'It couldn’t be sent.';
		} finally {
			busy = false;
			if (input) input.value = '';
		}
	}
</script>

<div class="picture-field">
	{#if src}<img {src} alt="" />{/if}
	<div class="row">
		<input
			bind:this={input}
			{id}
			type="file"
			accept="image/png,image/jpeg,image/webp,image/gif"
			{disabled}
			onchange={send}
			hidden
		/>
		<button type="button" disabled={disabled || busy} onclick={() => input?.click()}>
			{busy ? 'Sending…' : src ? 'Choose another' : 'Choose a picture'}
		</button>
		{#if src && !disabled}<button type="button" class="plain" onclick={() => onchange('')}
				>Take it off</button
			>{/if}
	</div>
	<small>PNG, JPEG, WebP or GIF, up to 8 MB.</small>
	{#if problem}<span class="problem" role="alert">{problem}</span>{/if}
</div>

<style>
	.picture-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	img {
		max-width: 100%;
		max-height: 160px;
		object-fit: contain;
		align-self: flex-start;
		border-radius: 8px;
		border: 1px solid var(--line);
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	button {
		height: 40px;
		padding: 0 14px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink);
		font-weight: 600;
	}
	.plain {
		border-color: transparent;
		background: none;
		color: var(--ink-muted);
	}
	small {
		color: var(--ink-muted);
	}
	.problem {
		color: var(--alert);
		font-size: 13px;
	}
</style>
