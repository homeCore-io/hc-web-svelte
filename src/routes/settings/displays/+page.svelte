<!--
	Displays (D7, M5): a kitchen panel, a hall tablet — each its own identity
	in homeCore, made here. Its key is shown once, to type on the tablet at
	/display. What it shows and how it behaves are kept by the UI server.
	Its name is homeCore's, and can be changed from homeCore 0.1.81.
-->
<script lang="ts">
	import { agoOf } from '#lib/when.js';
	import { onMount } from 'svelte';
	import { onReturn } from '#lib/refresh.js';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import X from '@lucide/svelte/icons/x';
	import { session } from '#lib/me.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { nudgeFavourite } from '#lib/layers.js';
	import { tabsFor, type DisplayDoc } from '#lib/display.js';
	import { core } from '#lib/core.svelte.js';

	interface Display {
		id: string;
		name: string;
		created_at: string;
		last_used_at: string | null;
		revoked: boolean;
	}

	let list = $state<Display[] | null>(null);
	let trouble = $state<string | null>(null);
	async function reload() {
		const res = await fetch('/api/v1/displays').catch(() => null);
		list = res?.ok ? ((await res.json()) as Display[]).filter((d) => !d.revoked) : null;
	}
	onMount(() => {
		void reload();
		return onReturn(reload);
	});

	// ---- a new display ----
	let name = $state('');
	let made = $state<{ name: string; token: string } | null>(null);
	async function create(e: SubmitEvent) {
		e.preventDefault();
		const res = await fetch('/api/v1/displays', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name })
		}).catch(() => null);
		const body = (await res?.json().catch(() => ({}))) as { token?: string; error?: string };
		if (!res?.ok || !body.token) {
			trouble = body.error ?? 'Couldn’t make the display.';
			return;
		}
		made = { name, token: body.token };
		name = '';
		trouble = null;
		await reload();
	}

	async function remove(d: Display) {
		const yes = await ask({
			title: `Delete ${d.name}?`,
			body: 'The tablet stops working until it is set up again with a new key.',
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		await fetch(`/api/v1/displays/${d.id}`, { method: 'DELETE' }).catch(() => null);
		if (open === d.id) open = null;
		await reload();
	}

	// ---- one display's settings ----
	let open = $state<string | null>(null);
	let doc = $state<DisplayDoc>({ version: 0 });
	let newName = $state('');
	async function rename(d: Display) {
		const name = newName.trim();
		if (name === '' || name === d.name) return;
		const res = await fetch(`/api/v1/displays/${d.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name })
		}).catch(() => null);
		if (res?.ok) await reload();
		else trouble = 'homeCore didn’t rename it.';
	}

	async function edit(d: Display) {
		open = open === d.id ? null : d.id;
		newName = d.name;
		if (open === null) return;
		const res = await fetch(`/ui/displays/${d.id}`).catch(() => null);
		doc = res?.ok ? ((await res.json()) as DisplayDoc) : { version: 0 };
	}
	async function save(next: DisplayDoc, tries = 0): Promise<void> {
		doc = next;
		const res = await fetch(`/ui/displays/${open}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(next)
		}).catch(() => null);
		if (res?.status === 409 && tries < 2) {
			const { current } = (await res.json()) as { current: DisplayDoc };
			return save({ ...next, version: current.version }, tries + 1);
		}
		if (res?.ok) doc = (await res.json()) as DisplayDoc;
		else trouble = 'Couldn’t save that.';
	}

	const choices = $derived([
		{ key: 'home', label: 'Home' },
		{ key: 'scenes', label: 'Scenes' },
		{ key: 'alerts', label: 'Alerts' },
		...rooms.list.map((r) => ({ key: `room:${r.id}`, label: r.name }))
	]);
	const chosen = $derived(tabsFor(doc, rooms.list));
	const setPages = (pages: string[]) => save({ ...doc, pages });
	const setKiosk = (k: Partial<NonNullable<DisplayDoc['kiosk']>>) =>
		save({ ...doc, kiosk: { ...doc.kiosk, ...k } });

	const ago = (at: string | null) => {
		if (!at) return 'not set up yet';
		const mins = Math.round((Date.now() - Date.parse(at)) / 60_000);
		return mins < 2 ? 'in use now' : `seen ${agoOf(at)}`;
	};
</script>

{#if !session.isAdmin}
	<p class="quiet">Displays are for admins.</p>
{:else}
	<div class="stack">
		<p class="quiet">
			A display is a screen for the house — a kitchen panel, a hall tablet. It shows only the pages
			you choose, isn't anybody's account, and can never change settings. Anyone with a PIN can
			unlock it for a few minutes (set a PIN on Me).
		</p>

		<form class="new" onsubmit={create}>
			<input
				bind:value={name}
				placeholder="A name — Hall tablet, say"
				aria-label="New display's name"
			/>
			<button type="submit" disabled={name.trim() === ''}>Make a display</button>
		</form>

		{#if made}
			<div class="key" role="status">
				<p><strong>{made.name}</strong> is ready. On the tablet, open</p>
				<code>{location.origin}/display</code>
				<p>and enter this key. It is shown only now.</p>
				<code class="token">{made.token}</code>
				<div class="row">
					<button onclick={() => navigator.clipboard?.writeText(made!.token)}>Copy the key</button>
					<button class="plain" onclick={() => (made = null)}>Done</button>
				</div>
			</div>
		{/if}

		{#if list === null}
			<p class="quiet">Loading displays… (this needs homeCore v0.1.77 or later)</p>
		{:else if list.length === 0}
			<p class="quiet">No displays yet.</p>
		{:else}
			<ul>
				{#each list as d (d.id)}
					<li>
						<div class="line">
							<button class="name" aria-expanded={open === d.id} onclick={() => edit(d)}>
								<strong>{d.name}</strong>
								<span>{ago(d.last_used_at)}</span>
							</button>
							<button class="del" onclick={() => remove(d)}>Delete…</button>
						</div>
						{#if open === d.id}
							<div class="edit">
								{#if core.since('0.1.81')}
									<form
										class="rename"
										onsubmit={(e) => {
											e.preventDefault();
											void rename(d);
										}}
									>
										<input bind:value={newName} aria-label={`${d.name}'s name`} />
										<button
											type="submit"
											disabled={newName.trim() === '' || newName.trim() === d.name}>Rename</button
										>
									</form>
								{/if}
								<h3 class="section-label">Its pages, in order</h3>
								<ol>
									{#each chosen as t, i (t.key)}
										<li>
											<span>{t.label}{i === 0 ? ' · first' : ''}</span>
											<button
												aria-label={`Move ${t.label} up`}
												disabled={i === 0}
												onclick={() =>
													setPages(
														nudgeFavourite(
															chosen.map((c) => c.key),
															t.key,
															-1
														)
													)}><ArrowUp size={16} /></button
											>
											<button
												aria-label={`Move ${t.label} down`}
												disabled={i === chosen.length - 1}
												onclick={() =>
													setPages(
														nudgeFavourite(
															chosen.map((c) => c.key),
															t.key,
															1
														)
													)}><ArrowDown size={16} /></button
											>
											<button
												aria-label={`Take ${t.label} off`}
												disabled={chosen.length === 1}
												onclick={() =>
													setPages(chosen.map((c) => c.key).filter((k) => k !== t.key))}
												><X size={16} /></button
											>
										</li>
									{/each}
								</ol>
								<label class="add">
									<span>Add</span>
									<select
										value=""
										onchange={(e) => {
											const v = e.currentTarget.value;
											if (v) void setPages([...chosen.map((c) => c.key), v]);
											e.currentTarget.value = '';
										}}
									>
										<option value="" disabled>Choose a page…</option>
										{#each choices.filter((c) => !chosen.some((t) => t.key === c.key)) as c (c.key)}
											<option value={c.key}>{c.label}</option>
										{/each}
									</select>
								</label>

								<h3 class="section-label">As a kiosk</h3>
								<label class="check"
									><input
										type="checkbox"
										checked={doc.kiosk?.awake !== false}
										onchange={(e) => setKiosk({ awake: e.currentTarget.checked })}
									/> Keep the screen on</label
								>
								<label class="check"
									><input
										type="checkbox"
										checked={doc.kiosk?.night === true}
										onchange={(e) => setKiosk({ night: e.currentTarget.checked })}
									/> Dark while Night Mode is on</label
								>
								<label class="check"
									><input
										type="checkbox"
										checked={!!doc.kiosk?.reload}
										onchange={(e) => setKiosk({ reload: e.currentTarget.checked ? '04:00' : null })}
									/> Reload every day at</label
								>
								{#if doc.kiosk?.reload}
									<input
										class="time"
										type="time"
										value={doc.kiosk.reload}
										onchange={(e) => setKiosk({ reload: e.currentTarget.value || null })}
									/>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
	</div>
{/if}

<style>
	.stack {
		max-width: 640px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-2);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.new {
		display: flex;
		gap: var(--space-2);
	}
	.new input,
	select,
	.time {
		flex: 1;
		min-width: 0;
		min-height: var(--target);
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.time {
		align-self: flex-start;
		flex: none;
	}
	button {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}
	button:disabled {
		opacity: 0.4;
	}
	.plain {
		background: var(--surface-2);
		color: var(--ink);
	}
	.key {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px;
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.key p {
		margin: 0;
	}
	code {
		font-family: var(--font-num);
		font-size: 13px;
		word-break: break-all;
		padding: 8px 10px;
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
	}
	.row {
		display: flex;
		gap: 8px;
	}
	ul,
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	ul > li {
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.line {
		display: flex;
		align-items: center;
	}
	.name {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-height: 56px;
		padding: 8px 14px;
		border-radius: 12px;
		background: none;
		color: var(--ink);
		text-align: left;
	}
	.name span {
		font-size: 13px;
		font-weight: 400;
		color: var(--ink-muted);
	}
	ol button {
		min-height: 0;
		width: 36px;
		height: 36px;
		padding: 0;
		border-radius: 8px;
		background: none;
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* Delete… in words, like everywhere else — not a bare ✕. */
	.line .del {
		align-self: center;
		width: auto;
		min-height: 34px;
		margin-right: 8px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--alert);
		font-weight: 600;
	}
	.edit {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 4px 14px 14px;
	}
	.rename {
		display: flex;
		gap: 8px;
	}
	.rename input {
		flex: 1;
		min-width: 0;
		max-width: 320px;
		height: 38px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	.rename button {
		height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.rename button:disabled {
		opacity: 0.5;
	}
	h3 {
		margin: 8px 0 0;
	}
	ol li {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 0 4px 0 12px;
		min-height: 44px;
		border-radius: 10px;
		background: var(--sheet);
		border: 1px solid var(--line);
	}
	ol li span {
		flex: 1;
		font-weight: 600;
	}
	.add,
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.trouble {
		margin: 0;
		color: var(--alert);
	}
</style>
