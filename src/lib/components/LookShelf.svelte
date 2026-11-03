<!--
	Looks of one's own (13 §11, §12.3): the house's on Settings › Look, a
	person's on Me. Make a copy of a look to start one, save a look to a file
	to share it, add one from a file (made in another homeCore, or offline in
	code), remove one. Changing what a look chooses is the look editor's
	(step 4); until then a copy draws as the look it was made from.
-->
<script lang="ts">
	import { copyOf, fromFile, lookFile, newLookId, type Look } from '#lib/looks/model.js';

	let {
		label,
		own,
		all,
		chosen,
		save,
		pick,
		editHref
	}: {
		label: string;
		/** The looks kept here (the house's, or the person's own). */
		own: readonly Look[];
		/** Every look there is, so a copy's id and an added look's are new. */
		all: readonly Look[];
		/** The look chosen now: what "Make a copy" and "Save to a file" start from. */
		chosen: Look;
		/** Keep these as the looks here. */
		save: (looks: Look[]) => void;
		/** Choose a look just made or added. */
		pick: (id: string) => void;
		/** Where a look kept here is changed (the look editor). */
		editHref: (id: string) => string;
	} = $props();

	let name = $state('');
	let said = $state('');
	let trouble = $state('');

	function copy() {
		const from = chosen;
		const l = copyOf(from, name.trim() || `${from.name} copy`, all);
		save([...own, l]);
		pick(l.id);
		said = `${l.name} made from ${from.name}, and chosen. Change it to make it your own.`;
		name = '';
	}

	function download(l: Look) {
		const url = URL.createObjectURL(new Blob([lookFile(l)], { type: 'application/json' }));
		const a = Object.assign(document.createElement('a'), {
			href: url,
			download: `${l.id}.homecore-look.json`
		});
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	async function add(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		trouble = said = '';
		const got = fromFile(await file.text(), all);
		if (typeof got === 'string') {
			trouble = got;
			return;
		}
		// Another of the same id here already: kept beside it under a new one.
		const l = all.some((x) => x.id === got.id) ? { ...got, id: newLookId(got.name, all) } : got;
		save([...own, l]);
		said = `${l.name} added.`;
	}

	function remove(l: Look) {
		save(own.filter((x) => x.id !== l.id));
		said = `${l.name} removed.`;
	}
</script>

<div class="shelf" role="group" aria-label={label}>
	<div class="make">
		<label>
			<span>Make a copy of {chosen.name}</span>
			<input bind:value={name} placeholder="{chosen.name} copy" maxlength="60" />
		</label>
		<button onclick={copy}>Make</button>
	</div>

	{#if own.length}
		<ul>
			{#each own as l (l.id)}
				<li>
					<span class="name"
						>{l.name}{#if l.from}<small>
								from {all.find((x) => x.id === l.from)?.name ?? l.from}</small
							>{/if}</span
					>
					<a class="change" href={editHref(l.id)}>Change</a>
					<button class="plain" onclick={() => download(l)}>Save to a file</button>
					<button class="plain" onclick={() => remove(l)}>Remove</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="files">
		{#if !own.some((l) => l.id === chosen.id)}
			<button class="plain" onclick={() => download(chosen)}>Save {chosen.name} to a file</button>
		{/if}
		<label class="plain file">
			Add a look from a file
			<input type="file" accept=".json,application/json" onchange={add} />
		</label>
	</div>
	{#if said}<p class="said" role="status">{said}</p>{/if}
	{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
</div>

<style>
	.shelf {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 10px;
	}
	.make {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}
	.make label {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	input:not([type='file']) {
		padding: 9px 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	button,
	.file {
		padding: 9px 14px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
	}
	.change {
		padding: 9px 14px;
		border-radius: 10px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.name {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	small {
		color: var(--ink-muted);
		font-size: 12px;
	}
	.files {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.file {
		position: relative;
	}
	.file input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.file:focus-within {
		outline: 2px solid var(--accent);
	}
	.said {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.trouble {
		margin: 0;
		font-size: 13px;
		color: var(--alert);
	}
</style>
