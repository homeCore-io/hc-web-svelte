<!--
	Batteries as a list (13 §13.1, F2): each thing's level, lowest first, low
	ones marked as homeCore marks them. A tap opens the thing.
-->
<script lang="ts">
	import { page as here } from '$app/state';
	import { openDevice } from '#lib/popup.js';
	import type { Battery } from '#lib/batteries.js';

	let { list }: { list: Battery[] } = $props();
	const tone = (b: Battery) => (b.low ? 'low' : b.pct < 50 ? 'half' : 'ok');
</script>

<ul class="batteries">
	{#each list as b (b.id)}
		<li class={tone(b)}>
			<button onclick={() => openDevice(b.id, here.url)}>
				<span class="words"
					><b>{b.name}</b><small>{b.low ? 'Low · homeCore says replace it' : 'Fine'}</small></span
				>
				<span class="bar" aria-hidden="true"><span style:width={`${b.pct}%`}></span></span>
				<span class="pct">{b.pct}%</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.batteries {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--feel-card-radius);
		border: 1px solid var(--line);
		background: var(--surface);
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--line);
	}
	button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 9px 14px;
		border: none;
		background: transparent;
		color: var(--ink);
		text-align: left;
		font: inherit;
	}
	.low button {
		background: var(--alert-bg);
	}
	.words {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	b {
		font-size: 14px;
		font-weight: 600;
	}
	small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.low small {
		color: var(--alert);
	}
	.bar {
		width: 70px;
		height: 8px;
		flex: none;
		border-radius: 4px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: #6fd39a;
	}
	.half .bar span {
		background: var(--accent);
	}
	.low .bar span {
		background: var(--alert);
	}
	.pct {
		width: 42px;
		text-align: right;
		font-family: var(--font-num);
		font-size: 13px;
	}
	.low .pct {
		color: var(--alert);
	}
</style>
