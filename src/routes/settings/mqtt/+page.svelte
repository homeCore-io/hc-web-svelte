<!--
	Devices over MQTT (screen 1): Tasmota, Shelly, Zigbee2MQTT and other
	devices that talk MQTT, taken in by homeCore's ecosystem profiles with no
	plugin. Whether the house is ready for them (the broker, the type catalog,
	devices with no controls), each ecosystem, and what the broker carries
	that no ecosystem takes in.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { session } from '#lib/me.svelte.js';
	import { agoOf } from '#lib/when.js';
	import { loadBroker, type BrokerStatus } from '#lib/pluginAdmin.js';
	import TurnOn from '#lib/components/mqtt/TurnOn.svelte';
	import AddEcosystem from '#lib/components/mqtt/AddEcosystem.svelte';
	import {
		addCatalog,
		ecosystemName,
		loadOverview,
		looksLike,
		reloadFolder,
		type Overview
	} from '#lib/mqttDevices.js';

	/** The ecosystem being turned on: its file, name and what it is. */
	let turning = $state<{ file: string; label: string; description: string | null } | null>(null);
	/** Adding one of your own, perhaps from a heard topic. */
	let adding = $state<{ topic: string | null } | null>(null);

	async function readAgain() {
		busy = true;
		const r = await reloadFolder();
		busy = false;
		note = r.ok ? 'Read the profiles folder again.' : r.error;
		await load();
	}

	/** The shipped profile a heard topic belongs to, by its name, as a file to turn on. */
	const shippedFile = (name: string) =>
		view?.shipped_off.find((s) => s.name === name)?.file ??
		view?.off.find((o) => o.name === name)?.file ??
		null;

	let view = $state<Overview | null>(null);
	let broker = $state<BrokerStatus | null>(null);
	let failed = $state<string | null>(null);
	let note = $state<string | null>(null);
	let busy = $state(false);

	/** Why the last refresh failed, while what came before stays shown. */
	let stale = $state<string | null>(null);
	async function load() {
		if (!session.isAdmin) return;
		const [o, b] = await Promise.all([loadOverview(), loadBroker()]);
		if (!o.ok) {
			// A failed refresh keeps the page; only a first load that fails replaces it.
			if (view) stale = o.error;
			else failed = o.error;
			return;
		}
		failed = stale = null;
		view = o.data;
		broker = b.ok ? b.data : null;
	}
	onMount(() => {
		void load();
		const t = setInterval(load, 15_000);
		return () => clearInterval(t);
	});

	async function addTypes() {
		busy = true;
		const r = await addCatalog();
		busy = false;
		note = r.ok ? 'Device types added. Devices given a type now get their controls.' : r.error;
		await load();
	}

	const on = $derived((view?.profiles ?? []).filter((p) => p.name));
	const broken = $derived((view?.profiles ?? []).filter((p) => !p.name));
	const initial = (s: string) =>
		s
			.replace(/[^A-Za-z0-9]/g, '')
			.charAt(0)
			.toUpperCase() || '?';
</script>

{#if !session.isAdmin}
	<p class="quiet">Devices over MQTT are for the house’s admins.</p>
{:else if failed}
	<p class="quiet">{failed}</p>
{:else if !view}
	<p class="quiet">Loading…</p>
{:else}
	<div class="page">
		<div class="top">
			<p class="lead">
				Tasmota, Shelly, Zigbee2MQTT and other devices that already talk MQTT, taken in without a
				plugin.
			</p>
			<button type="button" class="primary" onclick={() => (adding = { topic: null })}
				>Add an ecosystem</button
			>
		</div>
		{#if note}<p class="note" role="status">{note}</p>{/if}
		{#if stale}<p class="quiet" role="status">Not up to date: {stale}</p>{/if}

		{#if view.warnings?.length}
			<ul class="warnings" role="status">
				{#each view.warnings as w (w)}<li>{w}</li>{/each}
			</ul>
		{/if}

		<section class="ready" aria-label="Readiness">
			<div class="card" class:bad={broker && !broker.reachable_from_network}>
				<p class="head">
					{#if broker?.reachable_from_network}<Check
							size={18}
							aria-hidden="true"
						/>{:else}<CircleAlert size={18} aria-hidden="true" />{/if}
					{!broker
						? 'Broker: not known'
						: broker.reachable_from_network
							? 'Broker open to the network'
							: 'Broker only on this machine'}
				</p>
				<p class="sub">
					{#if broker}{broker.host}:{broker.port}{/if}
					{#if broker && !broker.reachable_from_network}· Devices can’t reach it.
						<a href="/settings/plugins/runtimes">Open it</a>{/if}
				</p>
			</div>
			<div class="card" class:bad={!view.catalog.present}>
				<p class="head">
					{#if view.catalog.present}<Check size={18} aria-hidden="true" />{:else}<CircleAlert
							size={18}
							aria-hidden="true"
						/>{/if}
					Device types
				</p>
				<p class="sub">
					{#if view.catalog.present}{view.catalog.types} types{:else if view.catalog.error}It
						doesn’t load: {view.catalog.error}{:else}None yet, so no device gets controls.
						<button type="button" class="link" disabled={busy} onclick={addTypes}>Add them</button
						>{/if}
				</p>
			</div>
			<div class="card" class:bad={view.untyped > 0}>
				<p class="head">
					{#if view.untyped === 0}<Check size={18} aria-hidden="true" />{:else}<CircleAlert
							size={18}
							aria-hidden="true"
						/>{/if}
					{view.untyped === 0
						? 'Every device has controls'
						: view.untyped === 1
							? 'One device without controls'
							: `${view.untyped} devices without controls`}
				</p>
				<p class="sub">
					{view.untyped === 0
						? 'Each says what it is.'
						: 'They report, but homeCore doesn’t know what they are. Open their ecosystem to say.'}
				</p>
			</div>
		</section>

		<section aria-labelledby="eco-h">
			<h2 id="eco-h">Ecosystems</h2>
			{#if on.length === 0 && broken.length === 0 && view.shipped_off.length === 0 && view.off.length === 0}
				<p class="quiet">None yet. Add one of your own.</p>
			{:else}
				<ul class="list">
					{#each on as p (p.file)}
						<li>
							<a href={`/settings/mqtt/${encodeURIComponent(p.name!)}`}>
								<span class="mark">{initial(ecosystemName(p.name!))}</span>
								<span class="text">
									<span class="name">{ecosystemName(p.name!)}</span>
									<span class="sub"
										>{p.devices === 1 ? 'One device' : `${p.devices ?? 0} devices`}{p.last_heard
											? ` · heard ${agoOf(p.last_heard)}`
											: ''}{p.shipped ? '' : ' · yours'}</span
									>
								</span>
								{#if (p.untyped ?? 0) > 0}<span class="chip bad"
										>{p.untyped === 1 ? '1 needs a type' : `${p.untyped} need a type`}</span
									>{/if}
								{#if p.differs_from_shipped}<span
										class="chip lit"
										title="Open its Profile tab to compare">Differs from homeCore's</span
									>{/if}
								<ChevronRight size={18} aria-hidden="true" />
							</a>
						</li>
					{/each}
					{#each broken as p (p.file)}
						<li>
							<div class="row">
								<span class="mark bad">!</span>
								<span class="text">
									<span class="name">{p.file}</span>
									<span class="sub error">Not loaded: {p.error}</span>
								</span>
								<a class="btn" href={`/settings/mqtt/files/${encodeURIComponent(p.file)}`}>Fix it</a
								>
							</div>
						</li>
					{/each}
					{#each view.off as o (o.file)}
						<li>
							<div class="row">
								<span class="mark off">{initial(ecosystemName(o.name ?? o.file))}</span>
								<span class="text">
									<span class="name">{ecosystemName(o.name ?? o.file)}</span>
									<span class="sub">Off · kept as you left it</span>
								</span>
								<a class="btn" href={`/settings/mqtt/files/${encodeURIComponent(o.file)}`}
									>Profile</a
								>
								<button
									type="button"
									class="btn"
									onclick={() =>
										(turning = {
											file: o.file,
											label: ecosystemName(o.name ?? o.file),
											description: o.description
										})}>Turn on</button
								>
							</div>
						</li>
					{/each}
					{#each view.shipped_off.filter((s) => !view?.off.some((o) => o.file === s.file)) as s (s.file)}
						<li>
							<div class="row">
								<span class="mark off">{initial(ecosystemName(s.name))}</span>
								<span class="text">
									<span class="name">{ecosystemName(s.name)}</span>
									<span class="sub">Off · comes with homeCore</span>
								</span>
								<button
									type="button"
									class="btn"
									onclick={() =>
										(turning = {
											file: s.file,
											label: ecosystemName(s.name),
											description: s.description
										})}>Turn on</button
								>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="quiet">
				Changed a profile file by hand?
				<button type="button" class="link" disabled={busy} onclick={readAgain}
					>Read the folder again</button
				>
			</p>
		</section>

		<section aria-labelledby="heard-h">
			<div class="split">
				<h2 id="heard-h">Heard, but not taken in</h2>
				<span class="quiet">Topics on the broker no ecosystem matched, in the last hour</span>
			</div>
			{#if view.heard.length === 0}
				<p class="quiet">Nothing. Every topic the broker carried was taken in.</p>
			{:else}
				<div class="scroll">
					<table>
						<thead>
							<tr
								><th scope="col">Topic</th><th scope="col">Messages</th><th scope="col"
									>Looks like</th
								><th scope="col"><span class="hidden">Action</span></th></tr
							>
						</thead>
						<tbody>
							{#each view.heard.slice(0, 50) as h (h.topic)}
								<tr>
									<td class="topic">{h.topic}</td>
									<td>{h.count}</td>
									<td class:quiet={!h.looks_like}
										>{looksLike(h) ? `${looksLike(h)}, which is off` : 'Nothing homeCore has'}</td
									>
									<td class="act">
										{#if h.looks_like && shippedFile(h.looks_like)}
											<button
												type="button"
												class="btn"
												onclick={() =>
													(turning = {
														file: shippedFile(h.looks_like!)!,
														label: looksLike(h)!,
														description: null
													})}>Turn on</button
											>
										{:else}
											<button
												type="button"
												class="btn"
												onclick={() => (adding = { topic: h.topic })}>Write a profile</button
											>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if view.heard.length > 50}<p class="quiet">
						And {view.heard.length - 50} more.
					</p>{/if}
			{/if}
		</section>
	</div>
{/if}

{#if turning && view}
	<TurnOn
		file={turning.file}
		label={turning.label}
		description={turning.description}
		brokerOpen={broker ? broker.reachable_from_network : null}
		catalog={view.catalog.present}
		kept={view.off.some((o) => o.file === turning?.file)}
		close={() => (turning = null)}
		done={(n) => {
			note = n;
			void load();
		}}
	/>
{/if}
{#if adding && view}
	<AddEcosystem heard={view.heard} topic={adding.topic} close={() => (adding = null)} />
{/if}

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
	}
	.primary {
		min-height: var(--target);
		padding: 0 18px;
		border-radius: 11px;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.btn {
		flex: none;
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		text-decoration: none;
		cursor: pointer;
	}
	.mark.off {
		background: var(--side);
		color: var(--ink-muted);
	}
	.act {
		text-align: right;
		white-space: nowrap;
	}
	.hidden {
		position: absolute;
		left: -9999px;
	}
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 980px;
	}
	.lead {
		margin: 0;
		color: var(--ink-muted);
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 18px;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.ready {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-2);
	}
	.card {
		padding: 14px 16px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.card.bad {
		background: var(--alert-bg);
		border-color: var(--alert-line);
	}
	.card .head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-weight: 700;
	}
	.card:not(.bad) .head :global(svg) {
		color: var(--good-ink, var(--ink));
	}
	.card.bad .head {
		color: var(--alert);
	}
	.card .sub {
		margin: 6px 0 0;
		font-size: 14px;
		color: var(--ink-muted);
	}
	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.list a,
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 64px;
		padding: 8px var(--space-3) 8px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 11px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 800;
	}
	.mark.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: 700;
	}
	.sub {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.sub.error {
		color: var(--alert);
		overflow-wrap: anywhere;
	}
	.chip {
		flex: none;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
	}
	.chip.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.chip.lit {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.split {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px var(--space-3);
	}
	.split h2 {
		margin: 0;
	}
	.scroll {
		overflow-x: auto;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	table {
		width: 100%;
		min-width: 560px;
		border-collapse: collapse;
		font-size: 14px;
	}
	th {
		padding: 10px var(--space-3);
		text-align: left;
		font-size: 12px;
		color: var(--ink-muted);
	}
	td {
		padding: 10px var(--space-3);
		border-top: 1px solid var(--line);
	}
	.topic {
		font-family: var(--font-num);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.warnings {
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
		border-radius: 10px;
		background: var(--alert-bg);
		border: 1px solid var(--alert-line);
		color: var(--ink);
		font-size: 14px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
</style>
