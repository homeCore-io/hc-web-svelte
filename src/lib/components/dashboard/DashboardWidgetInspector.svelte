<script lang="ts">
	import { dashboardCardSpec } from '$lib/models/dashboardCards';
	import type { DashboardEditorState } from '$lib/stores/dashboardEditor.svelte';
	import { titleCase } from '$lib/utils/formatting';

	let { editor }: { editor: DashboardEditorState } = $props();

	const selectedWidget = $derived(editor.selectedWidget);
	const selectedPlacement = $derived(editor.selectedPlacement);
	const selectedPlacements = $derived(editor.selectedPlacements);
	const activeSections = $derived(editor.activeSections);
	const selectedSection = $derived(editor.selectedSection);
	const selectedSpec = $derived(selectedWidget ? dashboardCardSpec(selectedWidget.type) : null);
	const configEntries = $derived(
		selectedWidget ? Object.entries(selectedWidget.config ?? {}) : []
	);
	const configJson = $derived(selectedWidget ? JSON.stringify(selectedWidget.config ?? {}, null, 2) : '{}');
	let activeTab = $state<'card' | 'visibility' | 'layout' | 'actions'>('card');

	function csvValue(value: unknown): string {
		return Array.isArray(value) ? value.join(', ') : '';
	}

	function countValue(value: unknown, fallback: number): number {
		return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
	}

	function deviceCardSummary(config: Record<string, unknown>, type: string): string {
		const selectionMode = String(config.selection_mode ?? 'query');
		const limit = countValue(config.limit, 12);
		const showOffline = Boolean(config.show_offline ?? true);
		const source =
			selectionMode === 'area'
				? `area ${String(config.area_name ?? 'any area') || 'any area'}`
				: selectionMode === 'manual'
					? `${csvValue(config.device_ids) || 'selected devices'}`
					: `${String(config.query ?? '').trim() || 'all devices'}`;
		const cardLabel = type === 'device_list' ? 'device list' : 'device grid';
		return `${titleCase(cardLabel)} using ${selectionMode === 'query' ? 'query' : selectionMode === 'area' ? 'area' : 'manual selection'}: ${source}. Showing up to ${limit}${showOffline ? ', including offline devices.' : ', online only.'}`;
	}

	function eventFeedSummary(config: Record<string, unknown>): string {
		const limit = countValue(config.limit, 8);
		const groupBy = String(config.group_by ?? 'none');
		const area = String(config.area_name ?? '').trim();
		const types = csvValue(config.types);
		const devices = csvValue(config.device_ids);
		const filters = [area ? `area ${area}` : '', types ? `types ${types}` : '', devices ? `devices ${devices}` : '']
			.filter(Boolean)
			.join(', ');
		return `Recent events feed showing ${limit} item${limit === 1 ? '' : 's'}, grouped by ${groupBy === 'none' ? 'nothing' : groupBy}${filters ? `. Filters: ${filters}.` : '.'}`;
	}

	function deviceSourceLabel(config: Record<string, unknown>): string {
		const selectionMode = String(config.selection_mode ?? 'query');
		if (selectionMode === 'area') {
			return String(config.area_name ?? '').trim() || 'Area not set';
		}
		if (selectionMode === 'manual') {
			return csvValue(config.device_ids) || 'No devices picked';
		}
		return String(config.query ?? '').trim() || 'All devices';
	}

	function deviceDensityLabel(config: Record<string, unknown>): string {
		const limit = countValue(config.limit, 12);
		if (limit <= 4) return 'Minimal';
		if (limit <= 8) return 'Balanced';
		return 'Dense';
	}

	function eventScopeLabel(config: Record<string, unknown>): string {
		const area = String(config.area_name ?? '').trim();
		const types = csvValue(config.types);
		const devices = csvValue(config.device_ids);
		if (area) return `Area: ${area}`;
		if (devices) return `Devices: ${devices}`;
		if (types) return `Types: ${types}`;
		return 'All recent events';
	}

	function eventGroupingLabel(config: Record<string, unknown>): string {
		const groupBy = String(config.group_by ?? 'none');
		return groupBy === 'none' ? 'Ungrouped' : `Grouped by ${groupBy}`;
	}

	function markdownSummary(config: Record<string, unknown>): string {
		const text = String(config.markdown ?? '').trim();
		if (!text) return 'Empty note card. Add markdown content to show a short message or instructions.';
		const snippet = text.replace(/\s+/g, ' ').slice(0, 96);
		return `${snippet}${text.length > 96 ? '…' : ''}`;
	}

	function statSummarySummary(config: Record<string, unknown>): string {
		const metrics = ((config.metrics as string[] | undefined) ?? []).map((metric) => titleCase(metric));
		return metrics.length ? `Showing ${metrics.join(', ')}.` : 'No metrics selected yet.';
	}

	function modeChipSummary(config: Record<string, unknown>): string {
		const ids = csvValue(config.mode_ids);
		return ids ? `Showing selected modes: ${ids}.` : 'Showing every available mode.';
	}

	function sceneRowSummary(config: Record<string, unknown>): string {
		const ids = csvValue(config.scene_ids);
		return ids ? `Showing selected scenes: ${ids}.` : 'Showing every available scene.';
	}

	function deviceTileSummary(config: Record<string, unknown>): string {
		const selectionMode = String(config.selection_mode ?? 'manual');
		if (selectionMode === 'manual') return `Showing ${csvValue(config.device_ids) || 'the first selected device'}.`;
		if (selectionMode === 'area') return `Showing the first matching device in ${String(config.area_name ?? '').trim() || 'the selected area'}.`;
		return `Showing the first device matching ${String(config.query ?? '').trim() || 'the current query'}.`;
	}

	function dashboardLinkSummary(config: Record<string, unknown>): string {
		const ids = csvValue(config.dashboard_ids);
		return ids ? `Links to ${ids}.` : 'Using default dashboard navigation links.';
	}

	function mediaPlayerSummary(config: Record<string, unknown>): string {
		const selectionMode = String(config.selection_mode ?? 'manual');
		if (selectionMode === 'manual') return `Showing ${csvValue(config.device_ids) || 'the selected media player'}.`;
		if (selectionMode === 'area') return `Showing the first media player in ${String(config.area_name ?? '').trim() || 'the selected area'}.`;
		return `Showing the first media player matching ${String(config.query ?? '').trim() || 'the current query'}.`;
	}

	function cameraSummary(config: Record<string, unknown>): string {
		const url = String(config.url ?? '').trim();
		return url ? `Camera source ${url}. Refresh every ${Number(config.refresh_secs ?? 15)}s.` : 'No camera source configured yet.';
	}

	function webEmbedSummary(config: Record<string, unknown>): string {
		const url = String(config.url ?? '').trim();
		return url ? `Embedding ${url}.` : 'No embed URL configured yet.';
	}

	function historyChartSummary(config: Record<string, unknown>): string {
		const source = csvValue(config.device_ids) || String(config.area_name ?? '').trim() || String(config.query ?? '').trim() || 'device history';
		return `Showing ${source} across ${Number(config.timeframe_hours ?? 24)} hours with up to ${Number(config.limit ?? 24)} points.`;
	}

	function placementPresetLabel(placement: NonNullable<typeof selectedPlacement> | null): string {
		if (!placement) return 'No placement selected';
		const columns = editor.activeLayout?.columns ?? placement.w;
		if (placement.w >= columns) return placement.h >= 2 ? 'Hero' : 'Full width';
		if (placement.h >= 3) return 'Tall';
		if (placement.w >= Math.max(1, Math.floor(columns / 2))) return 'Half width';
		return 'Compact';
	}

	function layoutSummary(placement: NonNullable<typeof selectedPlacement> | null): string {
		if (!placement) return 'No active layout';
		const columns = editor.activeLayout?.columns ?? placement.w;
		return `${placementPresetLabel(placement)} card in ${columns}-column ${titleCase(editor.activeBreakpoint)} layout. Starts at row ${placement.y + 1}.`;
	}

	function suggestedTitle(widget: NonNullable<typeof selectedWidget>): string {
		const config = (widget.config ?? {}) as Record<string, unknown>;
		if (widget.type === 'device_list' || widget.type === 'device_grid') {
			const selectionMode = String(config.selection_mode ?? 'query');
			if (selectionMode === 'area') {
				const area = String(config.area_name ?? '').trim();
				if (area) return `${area} ${widget.type === 'device_list' ? 'Devices' : 'Overview'}`;
			}
			if (selectionMode === 'manual') return widget.type === 'device_list' ? 'Selected Devices' : 'Selected Device Grid';
			const query = String(config.query ?? '').trim();
			if (query) return titleCase(query);
			return widget.type === 'device_list' ? 'Device List' : 'Device Grid';
		}
		if (widget.type === 'event_feed') {
			const area = String(config.area_name ?? '').trim();
			if (area) return `${area} Events`;
			return 'Recent Events';
		}
		if (widget.type === 'markdown') {
			const text = String(config.markdown ?? '').trim();
			if (!text) return 'Note';
			const firstLine = text.split('\n').find((line) => line.trim())?.replace(/^#+\s*/, '').trim() ?? '';
			return firstLine.slice(0, 48) || 'Note';
		}
		return widget.title;
	}

	function suggestedSubtitle(widget: NonNullable<typeof selectedWidget>): string | null {
		const config = (widget.config ?? {}) as Record<string, unknown>;
		if (widget.type === 'device_list' || widget.type === 'device_grid') {
			const selectionMode = String(config.selection_mode ?? 'query');
			if (selectionMode === 'area') return 'Area-based device view';
			if (selectionMode === 'manual') return 'Manually selected devices';
			return String(config.query ?? '').trim() ? 'Query-based device view' : 'Live device view';
		}
		if (widget.type === 'event_feed') {
			const groupBy = String(config.group_by ?? 'none');
			return groupBy === 'none' ? 'Live event stream' : `Grouped by ${groupBy}`;
		}
		if (widget.type === 'markdown') {
			return 'Inline note card';
		}
		return widget.subtitle ?? null;
	}
</script>

<section class="panel">
	<div class="panel-header">
		<div>
			<p class="eyebrow">Inspector</p>
			<h2>Selected Card</h2>
		</div>
		<button type="button" class="toggle" onclick={() => editor.closeInspector()}>
			Close
		</button>
	</div>

	{#if editor.inspectorOpen}
		{#if selectedWidget && selectedSpec}
			<div class="panel-body">
				<div class="hero">
					<div class={`icon tone-${selectedSpec.tone}`} aria-hidden="true">{selectedSpec.icon}</div>
					<div>
						<strong>{selectedWidget.title}</strong>
						<p>{selectedWidget.subtitle ?? selectedSpec.family}</p>
						<div class="hero-pills">
							<span>{titleCase(selectedWidget.type)}</span>
							<span>{titleCase(editor.activeBreakpoint)}</span>
							<span>{selectedSpec.size}</span>
						</div>
					</div>
				</div>

				<div class="tab-row" role="tablist" aria-label="Card editor">
					<button type="button" role="tab" class:active={activeTab === 'card'} class="tab" onclick={() => (activeTab = 'card')}>Card</button>
					<button type="button" role="tab" class:active={activeTab === 'visibility'} class="tab" onclick={() => (activeTab = 'visibility')}>Data</button>
					<button type="button" role="tab" class:active={activeTab === 'layout'} class="tab" onclick={() => (activeTab = 'layout')}>Layout</button>
					<button type="button" role="tab" class:active={activeTab === 'actions'} class="tab" onclick={() => (activeTab = 'actions')}>Actions</button>
				</div>

				{#if activeTab === 'card'}
					<section class="section">
						<div class="section-head">
							<strong>Card Details</strong>
							<span>Name the card first. Card metadata stays separate from layout and section structure.</span>
						</div>
						<div class="live-summary">
							<strong>Suggested Label</strong>
							{#if selectedWidget}
								<span>{suggestedTitle(selectedWidget)}{#if suggestedSubtitle(selectedWidget)} · {suggestedSubtitle(selectedWidget)}{/if}</span>
							{/if}
						</div>
						<div class="action-row">
							{#if selectedWidget}
								<button
									type="button"
									class="secondary-button"
									onclick={() => editor.updateSelectedWidgetField('title', suggestedTitle(selectedWidget))}
								>
									Use Suggested Title
								</button>
								<button
									type="button"
									class="secondary-button"
									onclick={() => editor.updateSelectedWidgetField('subtitle', suggestedSubtitle(selectedWidget) ?? '')}
								>
									Use Suggested Subtitle
								</button>
							{/if}
						</div>
						<label class="field">
							<span>Title</span>
							<input
								type="text"
								value={selectedWidget.title}
								oninput={(event) =>
									editor.updateSelectedWidgetField(
										'title',
										(event.currentTarget as HTMLInputElement).value
									)}
							/>
						</label>
						<label class="field">
							<span>Subtitle</span>
							<input
								type="text"
								value={selectedWidget.subtitle ?? ''}
								placeholder="Optional subtitle"
								oninput={(event) =>
									editor.updateSelectedWidgetField(
										'subtitle',
										(event.currentTarget as HTMLInputElement).value
									)}
							/>
						</label>
						<details class="subsection">
							<summary>Advanced Card Settings</summary>
							<div class="section-body">
								<label class="field">
									<span>Refresh Policy</span>
									<select
										value={selectedWidget.refresh_policy}
										onchange={(event) =>
											editor.updateSelectedRefreshPolicy(
												(event.currentTarget as HTMLSelectElement)
													.value as typeof selectedWidget.refresh_policy
											)}
									>
										<option value="live">Live</option>
										<option value="poll">Poll</option>
										<option value="manual">Manual</option>
										<option value="passive">Passive</option>
									</select>
								</label>
							</div>
						</details>
					</section>
				{/if}

				{#if activeTab === 'layout'}
					<section class="section">
						<div class="section-head">
							<strong>Layout</strong>
							<span>Use size presets first. Raw grid controls are kept below only for precise cleanup.</span>
						</div>
						<div class="breakpoint-tabs">
							{#each editor.dashboard.layouts as layout (layout.breakpoint)}
								<button
									type="button"
									class:active={editor.activeBreakpoint === layout.breakpoint}
									class="breakpoint-tab"
									onclick={() => editor.setActiveBreakpoint(layout.breakpoint)}
								>
									{titleCase(layout.breakpoint)}
								</button>
							{/each}
						</div>
						<div class="preset-grid">
							<button type="button" class="preset" onclick={() => editor.applySelectedLayoutPreset('compact')}>Compact</button>
							<button type="button" class="preset" onclick={() => editor.applySelectedLayoutPreset('half')}>Half width</button>
							<button type="button" class="preset" onclick={() => editor.applySelectedLayoutPreset('full')}>Full width</button>
							<button type="button" class="preset" onclick={() => editor.applySelectedLayoutPreset('tall')}>Tall</button>
							<button type="button" class="preset" onclick={() => editor.applySelectedLayoutPreset('hero')}>Hero</button>
						</div>
						<div class="live-summary">
							<strong>Layout Summary</strong>
							<span>{layoutSummary(selectedPlacement)}</span>
						</div>
						<details class="subsection">
							<summary>Advanced Layout</summary>
							<div class="section-body">
								<div class="live-summary soft">
									<strong>Placement</strong>
									<span>
										{#if selectedPlacement}
											x {selectedPlacement.x} · y {selectedPlacement.y} · w {selectedPlacement.w} · h {selectedPlacement.h}
										{:else}
											No placement selected
										{/if}
									</span>
								</div>
								<button
									type="button"
									class="secondary-button"
									onclick={() => editor.copySelectedPlacementToAllBreakpoints(editor.activeBreakpoint)}
								>
									Copy {titleCase(editor.activeBreakpoint)} To All Breakpoints
								</button>
								<div class="placement-list">
									{#each selectedPlacements as placement (placement.breakpoint)}
										{@const placementSection = editor.dashboard.sections.find(
											(section) => section.id === placement.section_id && section.breakpoint === placement.breakpoint
										)}
										{@const sectionControlsLayout = placementSection?.layout_policy === 'stack'}
										<div class="placement-card">
											<div class="placement-head">
												<strong>{titleCase(placement.breakpoint)}</strong>
												<small>
													{placement.columns} columns{#if placementSection}
														· {titleCase(placementSection.layout_policy)}
													{/if}
												</small>
											</div>
											{#if sectionControlsLayout}
												<p class="layout-note">
													Stack sections control X and width automatically for this breakpoint.
												</p>
											{/if}
											<div class="field-row placement-row">
												<label class="field">
													<span>X</span>
													<input
														type="number"
														min="0"
														max={String(Math.max(0, placement.columns - 1))}
														value={String(placement.x)}
														disabled={sectionControlsLayout}
														oninput={(event) =>
															editor.updateSelectedPlacementField(
																placement.breakpoint,
																'x',
																Number((event.currentTarget as HTMLInputElement).value || 0)
															)}
													/>
												</label>
												<label class="field">
													<span>Y</span>
													<input
														type="number"
														min="0"
														value={String(placement.y)}
														oninput={(event) =>
															editor.updateSelectedPlacementField(
																placement.breakpoint,
																'y',
																Number((event.currentTarget as HTMLInputElement).value || 0)
															)}
													/>
												</label>
											</div>
											<div class="field-row placement-row">
												<label class="field">
													<span>Width</span>
													<input
														type="number"
														min="1"
														max={String(placement.columns)}
														value={String(placement.w)}
														disabled={sectionControlsLayout}
														oninput={(event) =>
															editor.updateSelectedPlacementField(
																placement.breakpoint,
																'w',
																Number((event.currentTarget as HTMLInputElement).value || 1)
															)}
													/>
												</label>
												<label class="field">
													<span>Height</span>
													<input
														type="number"
														min="1"
														value={String(placement.h)}
														oninput={(event) =>
															editor.updateSelectedPlacementField(
																placement.breakpoint,
																'h',
																Number((event.currentTarget as HTMLInputElement).value || 1)
															)}
													/>
												</label>
											</div>
										</div>
									{/each}
								</div>
							</div>
						</details>
					</section>
				{/if}

				{#if activeTab === 'visibility'}
					<section class="section">
						<div class="section-head">
							<strong>Card Data</strong>
							<span>Choose what content this card shows.</span>
						</div>
						{#if selectedWidget.type === 'device_grid' || selectedWidget.type === 'device_list'}
							{@const selectionMode = String(selectedWidget.config.selection_mode ?? 'query')}
							<section class="flow-group">
								<div class="group-head">
									<strong>Choose Devices</strong>
									<span>
										{selectedWidget.type === 'device_list'
											? 'Build a compact device list.'
											: 'Build a device overview grid.'}
									</span>
								</div>
								<div class="live-summary">
									<strong>Selection</strong>
									<span>{deviceCardSummary(selectedWidget.config as Record<string, unknown>, selectedWidget.type)}</span>
								</div>
								<div class="live-summary soft">
									<strong>Current source</strong>
									<span>{deviceSourceLabel(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button type="button" class:active={selectionMode === 'query'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'query')}>Match query</button>
									<button type="button" class:active={selectionMode === 'area'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'area')}>Use area</button>
									<button type="button" class:active={selectionMode === 'manual'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'manual')}>Pick devices</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Choose whether this card follows a query, an area, or a hand-picked set of devices.</span>
								</div>
								{#if selectionMode === 'query'}
									<label class="field">
										<span>Match query</span>
										<input
											type="text"
											value={String(selectedWidget.config.query ?? '')}
											placeholder="lamp, media, kitchen..."
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'query',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{:else if selectionMode === 'area'}
									<label class="field">
										<span>Area</span>
										<input
											type="text"
											value={String(selectedWidget.config.area_name ?? '')}
											placeholder="Living Room"
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'area_name',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{:else}
									<label class="field">
										<span>Device IDs</span>
										<input
											type="text"
											value={csvValue(selectedWidget.config.device_ids)}
											placeholder="device.one, device.two"
											oninput={(event) =>
												editor.updateSelectedStringListField(
													'device_ids',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{/if}
							</section>
							<section class="flow-group">
								<div class="group-head">
									<strong>Card Density</strong>
									<span>Choose how much device detail to show before you fine-tune the count.</span>
								</div>
								<div class="live-summary soft">
									<strong>Current density</strong>
									<span>{deviceDensityLabel(selectedWidget.config as Record<string, unknown>)} · up to {countValue(selectedWidget.config.limit, 12)} devices</span>
								</div>
								<div class="choice-row">
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('limit', 4)}>Minimal</button>
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('limit', 8)}>Balanced</button>
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('limit', 12)}>Dense</button>
								</div>
								<div class="step-note">
									<strong>Step 2</strong>
									<span>Start with a density preset, then adjust the exact device count if needed.</span>
								</div>
								<div class="field-row">
									<label class="field">
										<span>Visible devices</span>
										<input
											type="number"
											min="1"
											max="999"
											value={String(countValue(selectedWidget.config.limit, 12))}
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'limit',
													Number((event.currentTarget as HTMLInputElement).value || 0)
												)}
										/>
									</label>
									<label class="check">
										<input
											type="checkbox"
											checked={Boolean(selectedWidget.config.show_offline ?? true)}
											onchange={(event) =>
												editor.updateSelectedConfigField(
													'show_offline',
													(event.currentTarget as HTMLInputElement).checked
												)}
										/>
										<span>Include offline devices</span>
									</label>
								</div>
							</section>
						{:else if selectedWidget.type === 'event_feed'}
							<section class="flow-group">
								<div class="group-head">
									<strong>Feed Scope</strong>
									<span>Choose what kind of activity this card should follow.</span>
								</div>
								<div class="live-summary">
									<strong>Feed summary</strong>
									<span>{eventFeedSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="live-summary soft">
									<strong>Current scope</strong>
									<span>{eventScopeLabel(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button
										type="button"
										class="choice-chip"
										onclick={() => {
											editor.updateSelectedConfigField('area_name', '');
											editor.updateSelectedStringListField('device_ids', '');
											editor.updateSelectedStringListField('types', '');
										}}
									>
										Everything
									</button>
									<button
										type="button"
										class="choice-chip"
										onclick={() => {
											editor.updateSelectedConfigField('area_name', '');
											editor.updateSelectedStringListField('device_ids', '');
										}}
									>
										By type
									</button>
									<button
										type="button"
										class="choice-chip"
										onclick={() => {
											editor.updateSelectedConfigField('area_name', '');
											editor.updateSelectedStringListField('types', '');
										}}
									>
										By device
									</button>
									<button
										type="button"
										class="choice-chip"
										onclick={() => {
											editor.updateSelectedStringListField('device_ids', '');
											editor.updateSelectedStringListField('types', '');
										}}
									>
										By area
									</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Set the feed scope first, then add the specific filters that matter.</span>
								</div>
								<label class="field">
									<span>Area</span>
									<input
										type="text"
										value={String(selectedWidget.config.area_name ?? '')}
										placeholder="Living Room"
										oninput={(event) =>
											editor.updateSelectedConfigField(
												'area_name',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
								<label class="field">
									<span>Event Types</span>
									<input
										type="text"
										value={csvValue(selectedWidget.config.types)}
										placeholder="rule_fired, scene_activated"
										oninput={(event) =>
											editor.updateSelectedStringListField(
												'types',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
								<label class="field">
									<span>Device IDs</span>
									<input
										type="text"
										value={csvValue(selectedWidget.config.device_ids)}
										placeholder="sensor.motion, living_room.tv"
										oninput={(event) =>
											editor.updateSelectedStringListField(
												'device_ids',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
							</section>
							<section class="flow-group">
								<div class="group-head">
									<strong>Display</strong>
									<span>Choose how the feed should read at a glance.</span>
								</div>
								<div class="live-summary soft">
									<strong>Current display</strong>
									<span>{eventGroupingLabel(selectedWidget.config as Record<string, unknown>)} · {countValue(selectedWidget.config.limit, 8)} events</span>
								</div>
								<div class="choice-row">
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('limit', 4)}>Short list</button>
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('limit', 8)}>Balanced</button>
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('limit', 12)}>Dense</button>
								</div>
								<div class="step-note">
									<strong>Step 2</strong>
									<span>Choose how busy the feed should feel, then decide whether grouping helps readability.</span>
								</div>
								<div class="field-row">
									<label class="field">
										<span>Recent Events</span>
										<input
											type="number"
											min="1"
											max="100"
											value={String(countValue(selectedWidget.config.limit, 8))}
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'limit',
													Number((event.currentTarget as HTMLInputElement).value || 0)
												)}
										/>
									</label>
									<label class="field">
										<span>Group By</span>
										<select
											value={String(selectedWidget.config.group_by ?? 'none')}
											onchange={(event) =>
												editor.updateSelectedConfigField(
													'group_by',
													(event.currentTarget as HTMLSelectElement).value
												)}
										>
											<option value="none">No grouping</option>
											<option value="type">Event type</option>
											<option value="device">Device</option>
											<option value="area">Area</option>
										</select>
									</label>
								</div>
							</section>
						{:else if selectedWidget.type === 'stat_summary'}
							<section class="flow-group">
								<div class="group-head">
									<strong>Summary Metrics</strong>
									<span>Choose the counters that should anchor this dashboard area.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{statSummarySummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button
										type="button"
										class="choice-chip"
										onclick={() => editor.updateSelectedConfigField('metrics', ['devices', 'on', 'offline'])}
									>
										Home summary
									</button>
									<button
										type="button"
										class="choice-chip"
										onclick={() => editor.updateSelectedConfigField('metrics', ['devices', 'media_playing'])}
									>
										Devices + media
									</button>
									<button
										type="button"
										class="choice-chip"
										onclick={() => editor.updateSelectedConfigField('metrics', ['on', 'offline'])}
									>
										Active + offline
									</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Start with a preset, then fine-tune the individual counters if needed.</span>
								</div>
								<div class="choice-row">
									{#each ['devices', 'on', 'offline', 'media_playing'] as metric}
										{@const currentMetrics = ((selectedWidget.config.metrics as string[] | undefined) ?? [])}
										<button
											type="button"
											class:active={currentMetrics.includes(metric)}
											class="choice-chip"
											onclick={() => {
												const nextMetrics = currentMetrics.includes(metric)
													? currentMetrics.filter((entry) => entry !== metric)
													: [...currentMetrics, metric];
												editor.updateSelectedConfigField('metrics', nextMetrics);
											}}
										>
											{titleCase(metric)}
										</button>
									{/each}
								</div>
							</section>
						{:else if selectedWidget.type === 'mode_chips'}
							{@const useSelectedModes = (((selectedWidget.config.mode_ids as string[] | undefined) ?? []).length > 0)}
							<section class="flow-group">
								<div class="group-head">
									<strong>Mode Scope</strong>
									<span>Show all modes or keep this card focused on a specific set.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{modeChipSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button
										type="button"
										class:active={!useSelectedModes}
										class="choice-chip"
										onclick={() => editor.updateSelectedConfigField('mode_ids', [])}
									>
										All modes
									</button>
									<button
										type="button"
										class:active={useSelectedModes}
										class="choice-chip"
										onclick={() => {
											if (!useSelectedModes) editor.updateSelectedConfigField('mode_ids', []);
										}}
									>
										Selected modes
									</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Leave this broad for a house-wide dashboard, or narrow it to the few modes that matter here.</span>
								</div>
								<label class="field">
									<span>Mode IDs</span>
									<input
										type="text"
										value={csvValue(selectedWidget.config.mode_ids)}
										placeholder="security, guest, sleep"
										oninput={(event) =>
											editor.updateSelectedStringListField(
												'mode_ids',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
							</section>
						{:else if selectedWidget.type === 'scene_row'}
							{@const useSelectedScenes = (((selectedWidget.config.scene_ids as string[] | undefined) ?? []).length > 0)}
							<section class="flow-group">
								<div class="group-head">
									<strong>Scene Scope</strong>
									<span>Show the full scene row or keep it curated for this dashboard section.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{sceneRowSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button
										type="button"
										class:active={!useSelectedScenes}
										class="choice-chip"
										onclick={() => editor.updateSelectedConfigField('scene_ids', [])}
									>
										All scenes
									</button>
									<button
										type="button"
										class:active={useSelectedScenes}
										class="choice-chip"
										onclick={() => {
											if (!useSelectedScenes) editor.updateSelectedConfigField('scene_ids', []);
										}}
									>
										Selected scenes
									</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Keep only the scenes that belong in this part of the dashboard instead of dumping every scene into one row.</span>
								</div>
								<label class="field">
									<span>Scene IDs</span>
									<input
										type="text"
										value={csvValue(selectedWidget.config.scene_ids)}
										placeholder="goodnight, movie_time, away"
										oninput={(event) =>
											editor.updateSelectedStringListField(
												'scene_ids',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
							</section>
						{:else if selectedWidget.type === 'device_tile'}
							{@const selectionMode = String(selectedWidget.config.selection_mode ?? 'manual')}
							<section class="flow-group">
								<div class="group-head">
									<strong>Tile Source</strong>
									<span>Choose the single device this tile should represent.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{deviceTileSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button type="button" class:active={selectionMode === 'manual'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'manual')}>Pick device</button>
									<button type="button" class:active={selectionMode === 'query'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'query')}>Match query</button>
									<button type="button" class:active={selectionMode === 'area'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'area')}>Use area</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Tiles work best when they represent one important device rather than a group.</span>
								</div>
								{#if selectionMode === 'manual'}
									<label class="field">
										<span>Device IDs</span>
										<input
											type="text"
											value={csvValue(selectedWidget.config.device_ids)}
											placeholder="living_room.floor_lamp"
											oninput={(event) =>
												editor.updateSelectedStringListField(
													'device_ids',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{:else if selectionMode === 'area'}
									<label class="field">
										<span>Area</span>
										<input
											type="text"
											value={String(selectedWidget.config.area_name ?? '')}
											placeholder="Living Room"
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'area_name',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{:else}
									<label class="field">
										<span>Match query</span>
										<input
											type="text"
											value={String(selectedWidget.config.query ?? '')}
											placeholder="lamp, lock, media..."
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'query',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{/if}
							</section>
						{:else if selectedWidget.type === 'dashboard_link'}
							<section class="flow-group">
								<div class="group-head">
									<strong>Linked Dashboards</strong>
									<span>Choose the dashboards this card should link to.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{dashboardLinkSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('dashboard_ids', [])}>Use defaults</button>
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('dashboard_ids', ['getting_started'])}>Starter link</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Leave this broad for generic navigation, or provide explicit dashboard ids for a curated jump list.</span>
								</div>
								<label class="field">
									<span>Dashboard IDs</span>
									<input
										type="text"
										value={csvValue(selectedWidget.config.dashboard_ids)}
										placeholder="getting_started, downstairs"
										oninput={(event) =>
											editor.updateSelectedStringListField(
												'dashboard_ids',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
							</section>
						{:else if selectedWidget.type === 'media_player'}
							{@const selectionMode = String(selectedWidget.config.selection_mode ?? 'manual')}
							<section class="flow-group">
								<div class="group-head">
									<strong>Media Source</strong>
									<span>Choose the one media player this card should follow.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{mediaPlayerSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button type="button" class:active={selectionMode === 'manual'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'manual')}>Pick player</button>
									<button type="button" class:active={selectionMode === 'query'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'query')}>Match query</button>
									<button type="button" class:active={selectionMode === 'area'} class="choice-chip" onclick={() => editor.updateSelectedConfigField('selection_mode', 'area')}>Use area</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Keep this card tied to one player so transport state and artwork stay focused.</span>
								</div>
								{#if selectionMode === 'manual'}
									<label class="field">
										<span>Device IDs</span>
										<input
											type="text"
											value={csvValue(selectedWidget.config.device_ids)}
											placeholder="living_room.sonos"
											oninput={(event) =>
												editor.updateSelectedStringListField(
													'device_ids',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{:else if selectionMode === 'area'}
									<label class="field">
										<span>Area</span>
										<input
											type="text"
											value={String(selectedWidget.config.area_name ?? '')}
											placeholder="Living Room"
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'area_name',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{:else}
									<label class="field">
										<span>Match query</span>
										<input
											type="text"
											value={String(selectedWidget.config.query ?? '')}
											placeholder="sonos, tv, media"
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'query',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
								{/if}
							</section>
						{:else if selectedWidget.type === 'camera_video'}
							<section class="flow-group">
								<div class="group-head">
									<strong>Camera Source</strong>
									<span>Point this card at a live camera image or stream URL.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{cameraSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Set the source URL first, then tune how often the dashboard should refresh it.</span>
								</div>
								<label class="field">
									<span>Source URL</span>
									<input
										type="text"
										value={String(selectedWidget.config.url ?? '')}
										placeholder="https://camera.local/frame.jpg"
										oninput={(event) =>
											editor.updateSelectedConfigField(
												'url',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
								<label class="field">
									<span>Refresh seconds</span>
									<input
										type="number"
										min="1"
										value={String(Number(selectedWidget.config.refresh_secs ?? 15))}
										oninput={(event) =>
											editor.updateSelectedConfigField(
												'refresh_secs',
												Number((event.currentTarget as HTMLInputElement).value || 15)
											)}
									/>
								</label>
							</section>
						{:else if selectedWidget.type === 'web_embed'}
							<section class="flow-group">
								<div class="group-head">
									<strong>Embed Source</strong>
									<span>Link this card to a web page or hosted dashboard surface.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{webEmbedSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Use this for simple reference content or external dashboards, not device control.</span>
								</div>
								<label class="field">
									<span>URL</span>
									<input
										type="text"
										value={String(selectedWidget.config.url ?? '')}
										placeholder="https://example.com/status"
										oninput={(event) =>
											editor.updateSelectedConfigField(
												'url',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
							</section>
						{:else if selectedWidget.type === 'history_chart'}
							<section class="flow-group">
								<div class="group-head">
									<strong>History Scope</strong>
									<span>Choose what this chart should track over time.</span>
								</div>
								<div class="live-summary">
									<strong>Summary</strong>
									<span>{historyChartSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<div class="choice-row">
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('timeframe_hours', 6)}>6h</button>
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('timeframe_hours', 24)}>24h</button>
									<button type="button" class="choice-chip" onclick={() => editor.updateSelectedConfigField('timeframe_hours', 72)}>72h</button>
								</div>
								<div class="step-note">
									<strong>Step 1</strong>
									<span>Pick the source first, then decide how far back and how dense the chart should be.</span>
								</div>
								<label class="field">
									<span>Match query</span>
									<input
										type="text"
										value={String(selectedWidget.config.query ?? '')}
										placeholder="temperature, power, humidity"
										oninput={(event) =>
											editor.updateSelectedConfigField(
												'query',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
								<label class="field">
									<span>Device IDs</span>
									<input
										type="text"
										value={csvValue(selectedWidget.config.device_ids)}
										placeholder="weather.station, office.sensor"
										oninput={(event) =>
											editor.updateSelectedStringListField(
												'device_ids',
												(event.currentTarget as HTMLInputElement).value
											)}
									/>
								</label>
								<div class="field-row">
									<label class="field">
										<span>Timeframe hours</span>
										<input
											type="number"
											min="1"
											value={String(Number(selectedWidget.config.timeframe_hours ?? 24))}
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'timeframe_hours',
													Number((event.currentTarget as HTMLInputElement).value || 24)
												)}
										/>
									</label>
									<label class="field">
										<span>Point limit</span>
										<input
											type="number"
											min="1"
											value={String(Number(selectedWidget.config.limit ?? 24))}
											oninput={(event) =>
												editor.updateSelectedConfigField(
													'limit',
													Number((event.currentTarget as HTMLInputElement).value || 24)
												)}
										/>
									</label>
								</div>
							</section>
						{:else if selectedWidget.type === 'markdown'}
							<section class="flow-group">
								<div class="group-head">
									<strong>Content</strong>
									<span>Write the note exactly as it should appear in the card.</span>
								</div>
								<div class="live-summary">
									<strong>Preview</strong>
									<span>{markdownSummary(selectedWidget.config as Record<string, unknown>)}</span>
								</div>
								<label class="field">
									<span>Markdown</span>
									<textarea
										rows="8"
										value={String(selectedWidget.config.markdown ?? '')}
										oninput={(event) =>
											editor.updateSelectedConfigField(
												'markdown',
												(event.currentTarget as HTMLTextAreaElement).value
											)}
									></textarea>
								</label>
							</section>
						{:else}
							<div class="config-list compact">
								{#each configEntries as [key, value]}
									<div>
										<dt>{key}</dt>
										<dd>{JSON.stringify(value)}</dd>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/if}

				{#if activeTab === 'actions'}
					<section class="section">
						<div class="section-head">
							<strong>Actions</strong>
							<span>Move this card between sections or manage the card itself.</span>
						</div>
						<div class="action-row">
							<button type="button" class="secondary-button" onclick={() => editor.duplicateSelectedWidget()}>
								Duplicate
							</button>
							<button type="button" class="danger-button" onclick={() => editor.deleteSelectedWidget()}>
								Delete
							</button>
						</div>
						<div class="field-row section-assignment">
							<label class="field">
								<span>Section</span>
								<select
									value={selectedSection?.id ?? ''}
									onchange={(event) =>
										editor.assignSelectedWidgetToSection(
											(event.currentTarget as HTMLSelectElement).value || null
										)}
								>
									<option value="">Unassigned</option>
									{#each activeSections as section (section.id)}
										<option value={section.id}>{titleCase(section.title)}</option>
									{/each}
								</select>
							</label>
							<div class="field section-actions">
								<span>Section Tools</span>
								<div class="action-row">
									<button
										type="button"
										class="secondary-button"
										onclick={() => {
											const sectionId = editor.createSection(editor.activeBreakpoint, `${selectedWidget.title} Section`);
											editor.assignSelectedWidgetToSection(sectionId);
										}}
									>
										New Section
									</button>
									{#if selectedSection}
										<button type="button" class="secondary-button" onclick={() => editor.moveSection(selectedSection.id, -1)}>
											Move Up
										</button>
										<button type="button" class="secondary-button" onclick={() => editor.moveSection(selectedSection.id, 1)}>
											Move Down
										</button>
									{/if}
								</div>
							</div>
						</div>
						<details class="subsection">
							<summary>Advanced Tools</summary>
							<div class="section-body">
								<div class="placement-list compact-list">
									{#each selectedPlacements as placement (placement.breakpoint)}
										<div class="placement-card compact-card">
											<div class="placement-head">
												<strong>{titleCase(placement.breakpoint)}</strong>
												{#if editor.activeBreakpoint !== placement.breakpoint}
													<button
														type="button"
														class="link-button"
														onclick={() =>
															editor.copySelectedPlacement(editor.activeBreakpoint, placement.breakpoint)}
													>
														Use Active Layout
													</button>
												{:else}
													<span class="active-note">Source</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
								<label class="field">
									<span>Config JSON</span>
									<textarea
										rows="10"
										value={configJson}
										onchange={(event) =>
											editor.updateSelectedConfigFromJson(
												(event.currentTarget as HTMLTextAreaElement).value
											)}
									></textarea>
								</label>
								{#if editor.saveError}
									<p class="error">{editor.saveError}</p>
								{/if}
							</div>
						</details>
					</section>
				{/if}
			</div>
		{:else}
			<p class="empty">Select a card to inspect it.</p>
		{/if}
	{/if}
</section>

<style>
	.panel {
		border-radius: 0.7rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		box-shadow: none;
		padding: 0.8rem;
		display: grid;
		gap: 0.7rem;
	}

	.panel-header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.67rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: #8192a3;
	}

	h2 {
		margin: 0.08rem 0 0;
		font-size: 0.92rem;
	}

	.toggle {
		border: 1px solid var(--hc-border);
		border-radius: 0.45rem;
		background: var(--hc-surface);
		padding: 0.32rem 0.62rem;
		color: var(--hc-text-muted);
		font: inherit;
		font-size: 0.74rem;
	}

	.panel-body {
		display: grid;
		gap: 0.65rem;
	}

	.tab-row {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.tab {
		font: inherit;
		padding: 0.52rem 0.4rem;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text-muted);
		font-size: 0.76rem;
	}

	.tab.active {
		background: var(--hc-accent-soft);
		color: var(--hc-accent);
		border-color: color-mix(in srgb, var(--hc-accent) 20%, var(--hc-border));
	}

	.hero {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		padding: 0.7rem;
		border-radius: 0.5rem;
		background: var(--hc-surface-soft);
		border: 1px solid var(--hc-border);
	}

	.hero strong {
		display: block;
	}

	.hero p,
	.empty {
		margin: 0.08rem 0 0;
		color: #718396;
		font-size: 0.78rem;
	}

	.hero-pills,
	.grid-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.32rem;
		margin-top: 0.32rem;
	}

	.hero-pills span {
		padding: 0.22rem 0.46rem;
		border-radius: 0.4rem;
		background: var(--hc-surface);
		color: var(--hc-text-muted);
		font-size: 0.68rem;
	}

	.section {
		border-radius: 0.5rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		padding: 0.68rem;
	}

	.subsection {
		border-top: 1px solid #e7edf2;
		padding-top: 0.62rem;
	}

	.section-head {
		display: grid;
		gap: 0.12rem;
		margin-bottom: 0.62rem;
	}

	.section-head strong {
		font-size: 0.82rem;
		color: #314d66;
	}

	.section-head span {
		font-size: 0.74rem;
		color: #75889a;
	}

	.section summary,
	.subsection summary {
		cursor: pointer;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #5a7288;
	}

	.section-body {
		display: grid;
		gap: 0.62rem;
		margin-top: 0.62rem;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.preset {
		font: inherit;
		padding: 0.55rem 0.65rem;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
		text-align: left;
		font-size: 0.76rem;
	}

	.breakpoint-tabs,
	.action-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.section-actions {
		align-content: start;
	}

	.section-assignment {
		align-items: start;
	}

	.breakpoint-tab,
	.secondary-button,
	.link-button,
	.danger-button {
		font: inherit;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
	}

	.breakpoint-tab {
		padding: 0.28rem 0.54rem;
		font-size: 0.72rem;
	}

	.breakpoint-tab.active {
		background: var(--hc-accent-soft);
		border-color: color-mix(in srgb, var(--hc-accent) 20%, var(--hc-border));
		color: var(--hc-accent);
	}

	.secondary-button,
	.link-button,
	.danger-button {
		padding: 0.38rem 0.68rem;
		font-size: 0.74rem;
	}

	.link-button {
		padding: 0.26rem 0.54rem;
		font-size: 0.7rem;
	}

	.danger-button {
		border-color: color-mix(in srgb, var(--hc-danger) 20%, var(--hc-border));
		color: var(--hc-danger);
		background: var(--hc-danger-soft);
	}

	.field,
	.typed-config {
		display: grid;
		gap: 0.28rem;
	}

	.flow-group {
		display: grid;
		gap: 0.55rem;
		padding: 0.7rem;
		border-radius: 0.5rem;
		background: var(--hc-surface-soft);
		border: 1px solid var(--hc-border);
	}

	.group-head {
		display: grid;
		gap: 0.14rem;
	}

	.group-head strong {
		font-size: 0.8rem;
		color: #2f4d66;
	}

	.group-head span {
		font-size: 0.74rem;
		color: #728699;
	}

	.choice-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.live-summary {
		display: grid;
		gap: 0.16rem;
		padding: 0.58rem 0.66rem;
		border-radius: 0.45rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
	}

	.live-summary strong {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6f8397;
	}

	.live-summary span {
		font-size: 0.76rem;
		color: #445d74;
		line-height: 1.35;
	}

	.live-summary.soft {
		background: color-mix(in srgb, var(--hc-surface-soft) 72%, var(--hc-surface));
	}

	.step-note {
		display: grid;
		gap: 0.08rem;
		padding: 0.48rem 0.58rem;
		border-left: 2px solid color-mix(in srgb, var(--hc-accent) 28%, var(--hc-border));
		border-radius: 0 0.35rem 0.35rem 0;
		background: color-mix(in srgb, var(--hc-accent-soft) 42%, var(--hc-surface));
	}

	.step-note strong {
		font-size: 0.67rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--hc-accent);
	}

	.step-note span {
		font-size: 0.74rem;
		color: var(--hc-text-muted);
		line-height: 1.35;
	}

	.choice-chip {
		font: inherit;
		padding: 0.42rem 0.68rem;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text-muted);
		font-size: 0.74rem;
	}

	.choice-chip.active {
		background: var(--hc-accent-soft);
		border-color: color-mix(in srgb, var(--hc-accent) 20%, var(--hc-border));
		color: var(--hc-accent);
	}

	.field-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.field span {
		font-size: 0.72rem;
		color: #718396;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	input,
	select,
	textarea {
		font: inherit;
		padding: 0.56rem 0.64rem;
		border-radius: 0.45rem;
	}

	textarea {
		font-family: ui-monospace, monospace;
		font-size: 0.76rem;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding-top: 1.45rem;
		color: #60758a;
		font-size: 0.74rem;
	}

	.check input {
		padding: 0;
	}

	.placement-list {
		display: grid;
		gap: 0.45rem;
	}

	.placement-card {
		padding: 0.6rem;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid #e1e8ee;
		display: grid;
		gap: 0.5rem;
	}

	.compact-list {
		gap: 0.45rem;
	}

	.compact-card {
		padding: 0.5rem 0.58rem;
	}

	.placement-head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}

	.placement-head small,
	.active-note {
		color: #7a8c9f;
		font-size: 0.68rem;
	}

	.config-list {
		margin: 0;
		display: grid;
		gap: 0.45rem;
	}

	.config-list div {
		padding: 0.58rem 0.68rem;
		border-radius: 0.7rem;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid #e1e8ee;
	}

	.config-list dt {
		font-size: 0.68rem;
		font-weight: 700;
		color: #708397;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.config-list dd {
		margin: 0.18rem 0 0;
		color: #516579;
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
		overflow-wrap: anywhere;
	}

	.error {
		margin: 0;
		color: #a43627;
		font-size: 0.76rem;
	}

	.layout-note {
		margin: 0;
		font-size: 0.72rem;
		color: #6e8297;
	}

	.icon {
		width: 2rem;
		height: 2rem;
		border-radius: 0.72rem;
		display: grid;
		place-items: center;
		background: rgba(88, 117, 145, 0.12);
		color: #315476;
		flex: none;
	}

	.tone-good {
		background: rgba(223, 242, 231, 0.95);
		color: #1f6942;
	}

	.tone-warn {
		background: rgba(248, 238, 217, 0.98);
		color: #8b6217;
	}

	.tone-media {
		background: rgba(222, 237, 246, 0.98);
		color: #255f86;
	}

	@media (max-width: 720px) {
		.field-row {
			grid-template-columns: 1fr;
		}

		.check {
			padding-top: 0;
		}
	}
</style>
