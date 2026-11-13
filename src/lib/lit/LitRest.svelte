<!--
	A display at rest, in the Lit look (12): after a minute untouched, the
	time, the weather, what needs someone, and every room as a tile glowing
	as it is lit — the busiest bigger, breathing slowly. Any touch wakes it,
	and that touch does nothing else.
-->
<script lang="ts">
	import { houseNow } from '#lib/houseNow.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { ROOM_BUILT_IN } from '#lib/options.js';
	import { ref } from '#lib/layers.js';
	import { cardFor } from '#lib/card.js';
	import { byRoom } from '#lib/summary.js';
	import { roomBox } from '#lib/roomBox.js';
	import { stationOf, weatherOf } from '#lib/pieces.js';

	let { now, wake }: { now: Date; wake: () => void } = $props();

	const time = $derived(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
	const date = $derived(
		now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
	);

	const weather = $derived.by(() => {
		const d = stationOf(devices.byId, undefined);
		return d ? weatherOf(d, clock.now, 1) : undefined;
	});

	const tiles = $derived.by(() => {
		const grouped = byRoom(devices.byId, rooms.list);
		return (
			rooms.list
				.map((r) => {
					const here = grouped.get(r.id) ?? [];
					const box = roomBox(
						here,
						here.map((d) => cardFor(d, clock.now)),
						devices.byId,
						kindOptions.of('home', 'room', ref.room(r.id), ROOM_BUILT_IN),
						houseNow.lightIds
					);
					return { id: r.id, name: r.name, box, size: here.length };
				})
				.filter((t) => t.size > 0)
				// The busiest first: most lights on, then most lit, then most in it.
				.sort(
					(a, b) =>
						(b.box.lights?.on ?? 0) - (a.box.lights?.on ?? 0) ||
						b.box.glow - a.box.glow ||
						b.size - a.size
				)
		);
	});
	const said = $derived(alerts.list.slice(0, 3));
</script>

<!-- Woken by a whole tap, so the finger lifting can't press what's underneath. -->
<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="rest"
	role="presentation"
	onpointerdown={(e) => e.preventDefault()}
	onclick={(e) => {
		e.stopPropagation();
		wake();
	}}
	onkeydown={() => wake()}
>
	<div class="left">
		<div class="clock">
			<span class="time">{time}</span>
			<span class="date">{date}</span>
		</div>
		{#if weather?.temperature !== undefined}
			<div class="weather">
				<span class="temp">{Math.round(weather.temperature)}{weather.temperatureUnit}</span>
				{#if weather.forecast[0]?.condition}<span>{weather.forecast[0].condition}</span>{/if}
				{#if weather.readings.length}<small
						>{weather.readings
							.slice(0, 3)
							.map((r) => r.text)
							.join(' · ')}</small
					>{/if}
			</div>
		{/if}
		<div class="said">
			{#each said as a (a.id)}
				<span class="line"><span class="dot"></span>{a.message}</span>
			{/each}
			<small>Touch anywhere to use the house</small>
		</div>
	</div>
	<div class="rooms">
		{#each tiles as t, i (t.id)}
			<div
				class="tile"
				class:big={i < 2 && t.box.glow > 0}
				class:alarm={t.box.alarm || t.box.lines.some((l) => l.alert)}
				style:--g={t.box.glow}
			>
				{#if t.box.glow > 0}<span class="glow" aria-hidden="true"></span>{/if}
				<span class="name">{t.name}</span>
				<span class="foot">
					<span class="num">{t.box.temperature ?? ''}</span>
					<small
						>{t.box.lights
							? t.box.lights.on === 0
								? 'all off'
								: `${t.box.lights.on} of ${t.box.lights.of} on`
							: ''}</small
					>
				</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.rest {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		grid-template-columns: minmax(280px, 0.8fr) 2fr;
		gap: 44px;
		padding: 44px 52px;
		box-sizing: border-box;
		color: #eef1f5;
		background:
			radial-gradient(ellipse 70% 60% at 15% 0%, rgba(70, 60, 140, 0.45), transparent 70%),
			radial-gradient(ellipse 50% 50% at 0% 100%, rgba(255, 150, 70, 0.12), transparent 70%),
			#07090d;
		cursor: none;
	}
	.left {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 24px;
		min-width: 0;
	}
	.clock {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.time {
		font-family: var(--font-num);
		font-weight: 300;
		font-size: clamp(64px, 11vw, 128px);
		line-height: 0.95;
		letter-spacing: -0.03em;
	}
	.date {
		font-size: 20px;
		color: rgba(238, 241, 245, 0.7);
	}
	.weather {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 20px;
	}
	.temp {
		font-family: var(--font-num);
		font-size: 60px;
		line-height: 1;
	}
	small {
		font-size: 14px;
		color: rgba(238, 241, 245, 0.6);
	}
	.said {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 15px;
	}
	.line {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: #ff7a6b;
	}
	.rooms {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-auto-rows: minmax(96px, 1fr);
		gap: 10px;
		min-height: 0;
	}
	.tile {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 14px 16px;
		border-radius: var(--feel-card-radius);
		border: 1px solid rgba(255, 180, 90, calc(0.08 + var(--g) * 0.4));
		background: rgba(255, 255, 255, 0.03);
	}
	.tile.big {
		grid-column: span 2;
		grid-row: span 2;
	}
	.tile.alarm {
		border-color: rgba(255, 122, 107, 0.55);
	}
	.glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 80% 90% at 50% 120%,
			rgba(255, 170, 80, calc(var(--g) * 0.6)),
			transparent 70%
		);
		animation: breathe 6s ease-in-out infinite;
	}
	@keyframes breathe {
		0%,
		100% {
			opacity: 0.75;
		}
		50% {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glow {
			animation: none;
		}
	}
	.name,
	.foot {
		position: relative;
	}
	.name {
		font-weight: 600;
	}
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.num {
		font-family: var(--font-num);
		font-size: 24px;
	}
	.big .num {
		font-size: 40px;
	}
	@media (max-width: 760px) {
		.rest {
			grid-template-columns: 1fr;
			padding: 28px;
		}
		.rooms {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
