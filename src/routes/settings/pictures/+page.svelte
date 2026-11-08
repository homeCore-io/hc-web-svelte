<!--
	Pictures (design 15, P2): every picture and video this person may see,
	everyone's and their own. Add them, name them, share them or keep them
	theirs, put them in albums, see where each is used, and delete them (P4).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { onReturn } from '#lib/refresh.js';
	import Upload from '@lucide/svelte/icons/upload';
	import Play from '@lucide/svelte/icons/play';
	import { session } from '#lib/me.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { ACCEPT, pictures, sized, type Picture } from '#lib/pictures.svelte.js';
	import { usesSaid, type Names } from '#lib/pictureUses.js';

	onMount(() => {
		void pictures.load();
		return onReturn(() => void pictures.load());
	});

	// ---- what's shown ----
	type Filter = 'all' | 'shared' | 'mine' | 'video' | 'unused';
	let filter = $state<Filter>('all');
	let album = $state<string | null>(null);
	const FILTERS: [Filter, string][] = [
		['all', 'All'],
		['shared', 'Everyone’s'],
		['mine', 'Just mine'],
		['video', 'Videos'],
		['unused', 'Not used anywhere']
	];
	const used = (p: Picture) => p.uses.length + p.elsewhere > 0;
	const shown = $derived(
		pictures.items.filter((p) => {
			if (going.has(p.id)) return false;
			if (album) return p.albums.includes(album);
			if (filter === 'shared') return p.shared;
			if (filter === 'mine') return !p.shared;
			if (filter === 'video') return p.kind === 'video';
			if (filter === 'unused') return !used(p);
			return true;
		})
	);
	const count = $derived.by(() => {
		const v = pictures.items.filter((p) => p.kind === 'video').length;
		const n = pictures.items.length - v;
		const mine = pictures.items.filter((p) => !p.shared).length;
		return `${n} ${n === 1 ? 'picture' : 'pictures'}, ${v} ${v === 1 ? 'video' : 'videos'} · ${mine} just yours`;
	});

	// ---- what's chosen ----
	let sel = $state<string | null>(null);
	const picked = $derived(pictures.items.find((p) => p.id === sel && !going.has(p.id)));
	const names: Names = {
		room: (id) => rooms.list.find((r) => r.id === id)?.name,
		page: (id) =>
			[...(household.doc.built ?? []), ...(personal.doc.built ?? [])].find((p) => p.id === id)
				?.name,
		display: () => undefined
	};
	const uses = $derived(picked ? usesSaid(picked, names) : []);
	let problem = $state('');
	let confirming = $state(false);

	// ---- adding ----
	let input = $state<HTMLInputElement>();
	let over = $state(false);
	async function add(files: FileList | File[] | null | undefined) {
		problem = '';
		for (const f of files ?? []) {
			const sent = await pictures.upload(f);
			if (!sent.ok) problem = `${f.name}: ${sent.error}`;
			else sel = sent.picture.id;
		}
	}

	// ---- changing ----
	async function change(to: { name?: string; shared?: boolean; albums?: string[] }) {
		if (!picked) return;
		problem = (await pictures.change(picked, to)) ?? '';
	}
	let newAlbum = $state('');
	function addAlbum(e: SubmitEvent) {
		e.preventDefault();
		const a = newAlbum.trim();
		if (!a || !picked) return;
		void change({ albums: [...picked.albums, a] });
		newAlbum = '';
	}

	// ---- deleting: one used nowhere goes after a moment, with Undo ----
	let going = $state(new Set<string>());
	let toast = $state<{ id: string; text: string; timer: ReturnType<typeof setTimeout> } | null>(
		null
	);
	async function gone(p: Picture) {
		const why = await pictures.remove(p);
		if (why) problem = why;
		going = new Set([...going].filter((x) => x !== p.id));
	}
	function remove() {
		if (!picked) return;
		if (used(picked) && !confirming) {
			confirming = true;
			return;
		}
		const p = picked;
		confirming = false;
		sel = null;
		if (used(p)) {
			void gone(p);
			return;
		}
		if (toast) {
			clearTimeout(toast.timer);
			const was = pictures.items.find((x) => x.id === toast!.id);
			if (was) void gone(was);
		}
		going = new Set([...going, p.id]);
		toast = {
			id: p.id,
			text: `“${p.name}” deleted.`,
			timer: setTimeout(() => {
				toast = null;
				void gone(p);
			}, 6000)
		};
	}
	function undo() {
		if (!toast) return;
		clearTimeout(toast.timer);
		going = new Set([...going].filter((x) => x !== toast!.id));
		sel = toast.id;
		toast = null;
	}
	const ago = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	const mb = (b: number) =>
		b >= 1024 * 1024
			? `${(b / 1024 / 1024).toFixed(1)} MB`
			: `${Math.max(1, Math.round(b / 1024))} KB`;
</script>

{#if session.isDisplay}
	<p class="quiet">A display shows pictures; it doesn’t keep them.</p>
{:else}
	<div class="lib">
		<div class="main">
			<div class="top">
				<span class="quiet">{count}</span>
				<span class="grow"></span>
				<input
					bind:this={input}
					type="file"
					accept={ACCEPT}
					multiple
					hidden
					onchange={(e) => {
						void add([...(e.currentTarget.files ?? [])]);
						e.currentTarget.value = '';
					}}
				/>
				<button type="button" class="upload" onclick={() => input?.click()}
					><Upload size={16} aria-hidden="true" />Upload</button
				>
			</div>
			<div class="chips" role="group" aria-label="Show">
				{#each FILTERS as [f, label] (f)}
					<button
						type="button"
						aria-pressed={!album && filter === f}
						onclick={() => {
							filter = f;
							album = null;
						}}>{label}</button
					>
				{/each}
				{#if pictures.albums.length}
					<span class="label">Albums</span>
					{#each pictures.albums as a (a)}
						<button
							type="button"
							aria-pressed={album === a}
							onclick={() => (album = album === a ? null : a)}>{a}</button
						>
					{/each}
				{/if}
			</div>
			<div
				class="drop"
				class:over
				role="region"
				aria-label="Drop pictures or videos here"
				ondragover={(e) => {
					e.preventDefault();
					over = true;
				}}
				ondragleave={() => (over = false)}
				ondrop={(e) => {
					e.preventDefault();
					over = false;
					void add([...(e.dataTransfer?.files ?? [])]);
				}}
			>
				Drop pictures or videos here, or use Upload. Pictures: PNG, JPEG, WebP or GIF up to 20 MB.
				Videos: MP4 or WebM up to 200 MB, played silent.
			</div>
			{#if problem}<p class="problem" role="alert">{problem}</p>{/if}
			{#if pictures.trouble}<p class="problem" role="alert">{pictures.trouble}</p>{/if}
			<div class="grid">
				{#each pictures.sending as s (s.id)}
					<div class="tile sending">
						<div class="img">
							<span>Sending… {s.pct}%</span><span class="bar"
								><span style:width={`${s.pct}%`}></span></span
							>
						</div>
						<span class="name">{s.name}</span>
					</div>
				{/each}
				{#each shown as p (p.id)}
					<button
						type="button"
						class="tile"
						aria-pressed={sel === p.id}
						onclick={() => {
							sel = p.id;
							confirming = false;
						}}
					>
						<div class="img">
							<img src={sized(p.url, 'tile')} alt="" loading="lazy" />
							{#if p.kind === 'video'}<span class="badge"
									><Play size={11} aria-hidden="true" /></span
								>{/if}
							<span class="who">{p.shared ? 'Everyone' : 'Just me'}</span>
						</div>
						<span class="name">{p.name}</span>
						<span class="use" class:none={!used(p)}
							>{used(p)
								? `Used in ${p.uses.length + p.elsewhere} ${p.uses.length + p.elsewhere === 1 ? 'place' : 'places'}`
								: 'Not used anywhere'}</span
						>
					</button>
				{/each}
				{#if pictures.loaded && shown.length === 0 && pictures.sending.length === 0}
					<p class="quiet">
						{pictures.items.length === 0 ? 'No pictures yet. Add the first.' : 'None of these.'}
					</p>
				{/if}
			</div>
			{#if toast}
				<div class="toast" role="status">
					{toast.text}<button type="button" onclick={undo}>Undo</button>
				</div>
			{/if}
		</div>

		<aside class="panel" aria-label="The chosen picture">
			{#if picked}
				<div class="preview">
					{#if picked.kind === 'video'}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							src={picked.url}
							poster={sized(picked.url, 'poster')}
							muted
							loop
							controls
							playsinline
						></video>
					{:else}
						<img src={sized(picked.url, 'screen')} alt="" />
					{/if}
				</div>
				{#if picked.mayChange}
					<label class="field"
						>Name<input
							value={picked.name}
							onchange={(e) => change({ name: e.currentTarget.value })}
						/></label
					>
				{:else}
					<b>{picked.name}</b>
				{/if}
				<span class="quiet"
					>{picked.kind === 'video' ? 'Video' : 'Picture'} · {mb(picked.bytes)}{picked.by
						? ` · added by ${picked.mine ? 'you' : picked.by}, ${ago(picked.at)}`
						: ''}</span
				>
				<div class="group">
					<span class="label">Who sees it</span>
					<div class="chips">
						<button
							type="button"
							aria-pressed={picked.shared}
							disabled={!picked.mayChange && !picked.mine}
							onclick={() => change({ shared: true })}>Everyone in the house</button
						>
						<button
							type="button"
							aria-pressed={!picked.shared}
							disabled={!picked.mine}
							onclick={() => change({ shared: false })}>Just me</button
						>
					</div>
					<span class="quiet"
						>{picked.shared
							? picked.uses.some((u) => u.in !== 'person')
								? 'It’s on a room, a display or a shared page, so it stays everyone’s while it’s used there.'
								: 'Everyone in the house can use it.'
							: 'Only you see it, in your pictures and on your own pages.'}</span
					>
				</div>
				<div class="group">
					<span class="label">Albums</span>
					<div class="chips">
						{#each [...new Set([...pictures.albums, ...picked.albums])] as a (a)}
							<button
								type="button"
								aria-pressed={picked.albums.includes(a)}
								disabled={!picked.mayChange}
								onclick={() =>
									change({
										albums: picked.albums.includes(a)
											? picked.albums.filter((x) => x !== a)
											: [...picked.albums, a]
									})}>{picked.albums.includes(a) ? '✓ ' : '+ '}{a}</button
							>
						{/each}
					</div>
					{#if picked.mayChange}
						<form class="album" onsubmit={addAlbum}>
							<input bind:value={newAlbum} placeholder="A new album" aria-label="A new album" />
							<button type="submit" disabled={!newAlbum.trim()}>Add</button>
						</form>
					{/if}
				</div>
				<div class="group">
					<span class="label">Used in</span>
					{#each uses as u (u)}<span class="used">{u}</span>{/each}
					{#if uses.length === 0}<span class="quiet">Nowhere yet.</span>{/if}
				</div>
				{#if confirming}
					<div class="confirm" role="alert">
						It’s used in {uses.length === 1 ? 'one place' : `${uses.length} places`}: {uses.join(
							'; '
						)}. Deleting it takes it off them: a room goes back to its look’s drawing, a person to
						their initial, a Picture card asks for another.
						<div class="acts">
							<button type="button" class="danger" onclick={remove}>Take it off and delete</button>
							<button type="button" onclick={() => (confirming = false)}>Keep it</button>
						</div>
					</div>
				{/if}
				{#if picked.mayChange && !confirming}
					<button type="button" class="delete" onclick={remove}>Delete</button>
				{/if}
			{:else}
				<p class="quiet empty">
					Choose a picture to name it, share it, put it in an album, see where it’s used, or delete
					it.
				</p>
			{/if}
		</aside>
	</div>
{/if}

<style>
	.lib {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: var(--space-5);
		align-items: start;
		margin-top: var(--space-2);
	}
	@media (max-width: 900px) {
		.lib {
			grid-template-columns: 1fr;
		}
	}
	.main,
	.panel,
	.group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.group {
		gap: 6px;
	}
	.panel {
		position: sticky;
		top: 16px;
		padding: 16px;
		border-radius: var(--radius);
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.top {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.grow {
		flex: 1;
	}
	.upload {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 16px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink, #1a1406);
		font-weight: 700;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.chips button,
	.album button,
	.acts button {
		min-height: 32px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
	}
	.chips button[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.chips button:disabled {
		opacity: 0.5;
	}
	.label {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.chips .label {
		margin-left: 8px;
	}
	.drop {
		padding: 12px 14px;
		border: 1.5px dashed var(--line);
		border-radius: var(--radius);
		color: var(--ink-muted);
		font-size: 13px;
	}
	.drop.over {
		border-color: var(--accent);
		color: var(--ink);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 12px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 0 10px;
		border-radius: var(--radius);
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		text-align: left;
		overflow: hidden;
	}
	.tile[aria-pressed='true'] {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.img {
		position: relative;
		height: 120px;
		margin-bottom: 6px;
		background: var(--surface-2);
	}
	.img img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.sending .img {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.bar {
		width: 70%;
		height: 5px;
		border-radius: 3px;
		background: var(--line);
	}
	.bar span {
		display: block;
		height: 5px;
		border-radius: 3px;
		background: var(--accent);
	}
	.badge,
	.who {
		position: absolute;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
	}
	.badge {
		left: 8px;
		bottom: 8px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
	}
	.who {
		right: 8px;
		top: 8px;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
	}
	.name {
		padding: 0 10px;
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.use {
		padding: 0 10px;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.use.none {
		opacity: 0.7;
	}
	.toast {
		align-self: center;
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 10px 16px;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		font-size: 13px;
	}
	.toast button {
		border: none;
		background: none;
		color: var(--accent);
		font-weight: 700;
	}
	.preview {
		height: 200px;
		border-radius: 12px;
		overflow: hidden;
		background: var(--surface-2);
	}
	.preview img,
	.preview video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.field input,
	.album input {
		height: 36px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	.album {
		display: flex;
		gap: 6px;
	}
	.album input {
		flex: 1;
		min-width: 0;
	}
	.used {
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--surface-2);
		font-size: 13px;
	}
	.confirm {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--alert) 45%, transparent);
		background: color-mix(in srgb, var(--alert) 10%, transparent);
		font-size: 13px;
		line-height: 1.45;
	}
	.acts {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.acts .danger {
		border: none;
		background: var(--alert);
		color: #fff;
	}
	.delete {
		height: 38px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--alert) 45%, transparent);
		background: transparent;
		color: var(--alert);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.empty {
		padding: 30px 6px;
		text-align: center;
	}
	.problem {
		margin: 0;
		color: var(--alert);
		font-size: 13px;
	}
</style>
