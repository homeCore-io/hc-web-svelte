<script lang="ts">
	import DashboardWidget from '$lib/components/dashboard/DashboardWidget.svelte';
	import type {
		DashboardBreakpoint,
		DashboardDefinition,
		DashboardWidgetType,
		DashboardWidgetPlacement
	} from '$lib/models/dashboard';
	import { dashboardCardSpec } from '$lib/models/dashboardCards';
	import { dashboardBreakpointForWidth, layoutForBreakpoint } from '$lib/models/dashboard';
	import { resolveDashboardLayout, resolveDashboardSections } from '$lib/models/dashboardLayout';
	import { titleCase } from '$lib/utils/formatting';
	import type { DeviceState } from '$lib/models/device';
	import type { Scene } from '$lib/models/scene';
	import type { ModeState } from '$lib/models/mode';
	import type { HcEvent } from '$lib/models/event';

	let {
		dashboard,
		devices = [],
		scenes = [],
		modes = [],
		events = [],
		editing = true,
		selectedWidgetId = null,
		focusedSectionId = null,
		collapsedSectionIds = [],
		activeBreakpoint = null,
		onSelect,
		onInspect,
		onDuplicate,
		onDelete,
		onOpenAddAtSection,
		onEditSection,
		onFocusSection,
		onToggleSectionCollapsed,
		onInsertSection,
		onMoveWidgetToSection,
		onMoveWidgetToAdjacentSection,
		onClearSelection,
		onAddWidget,
		onNudge,
		onSetPlacement
	}: {
		dashboard: DashboardDefinition;
		devices?: DeviceState[];
		scenes?: Scene[];
		modes?: ModeState[];
		events?: HcEvent[];
		editing?: boolean;
		selectedWidgetId?: string | null;
		focusedSectionId?: string | null;
		collapsedSectionIds?: string[];
		activeBreakpoint?: DashboardBreakpoint | null;
		onSelect?: ((widgetId: string) => void) | undefined;
		onInspect?: ((widgetId: string) => void) | undefined;
		onDuplicate?: ((widgetId: string) => void) | undefined;
		onDelete?: ((widgetId: string) => void) | undefined;
		onOpenAddAtSection?: ((section: {
			breakpoint: DashboardBreakpoint;
			x: number;
			y: number;
			label: string;
			section_id?: string | null;
		}) => void) | undefined;
		onEditSection?: ((sectionId: string) => void) | undefined;
		onFocusSection?: ((sectionId: string) => void) | undefined;
		onToggleSectionCollapsed?: ((sectionId: string) => void) | undefined;
		onInsertSection?: ((options: {
			beforeSectionId?: string | null;
			afterSectionId?: string | null;
			y?: number;
		}) => void) | undefined;
		onMoveWidgetToSection?: ((
			widgetId: string,
			sectionId: string | null,
			placement?: Partial<Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'>>
		) => void) | undefined;
		onMoveWidgetToAdjacentSection?: ((widgetId: string, delta: number) => void) | undefined;
		onClearSelection?: (() => void) | undefined;
		onAddWidget?: ((
			type: DashboardWidgetType,
			breakpoint: DashboardBreakpoint,
			placement: Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'>
		) => void) | undefined;
		onNudge?: ((
			widgetId: string,
			breakpoint: DashboardBreakpoint,
			field: 'x' | 'y' | 'w' | 'h',
			delta: number
		) => void) | undefined;
		onSetPlacement?: ((
			widgetId: string,
			breakpoint: DashboardBreakpoint,
			placement: { x: number; y: number; w: number; h: number }
		) => void) | undefined;
	} = $props();

	let width = $state(1280);
	let gridEl = $state<HTMLDivElement | null>(null);
	let addPreview = $state<{
		type: DashboardWidgetType;
		x: number;
		y: number;
		w: number;
		h: number;
	} | null>(null);
	const addPreviewWidgetId = '__dashboard-add-preview__';
	let dragState = $state<{
		widgetId: string;
		mode: 'move' | 'resize';
		pointerId: number;
		startX: number;
		startY: number;
		originX: number;
		originY: number;
		originW: number;
		originH: number;
		previewX: number;
		previewY: number;
		previewW: number;
		previewH: number;
	} | null>(null);
	let menuOpenFor = $state<string | null>(null);
	let sectionMenuOpenFor = $state<string | null>(null);
	const responsiveBreakpoint = $derived(dashboardBreakpointForWidth(width));
	const breakpoint = $derived(activeBreakpoint ?? responsiveBreakpoint);
	const layout = $derived(layoutForBreakpoint(dashboard, breakpoint));
	const widgetById = $derived(new Map(dashboard.widgets.map((widget) => [widget.id, widget])));
	const hiddenSectionIdSet = $derived(
		new Set(dashboard.sections.filter((section) => section.hidden).map((section) => section.id))
	);
	const showSelectionHint = $derived(
		editing && !selectedWidgetId && !dragState && !addPreview && dashboard.widgets.length > 0
	);
	const previewPlacements = $derived.by(() => {
		const currentDrag = dragState;
		if (!layout || !currentDrag) return [];
		const nextLayout = {
			...layout,
			placements: layout.placements.map((placement) =>
				placement.widget_id === currentDrag.widgetId
					? {
							...placement,
							x: currentDrag.previewX,
							y: currentDrag.previewY,
							w: currentDrag.previewW,
							h: currentDrag.previewH
				}
					: placement
			)
		};
		return resolveDashboardLayout(nextLayout, {
			activeWidgetId: currentDrag.widgetId,
			preserveActivePosition: true,
			sections: dashboard.sections
		}).placements;
	});
	const activePreviewPlacement = $derived.by(() => {
		const currentDrag = dragState;
		if (!currentDrag) return null;
		return previewPlacements.find((placement) => placement.widget_id === currentDrag.widgetId) ?? null;
	});
	const addPreviewPlacements = $derived.by(() => {
		const preview = addPreview;
		if (!layout || !preview) return [];
		return resolveDashboardLayout({
			...layout,
			placements: [
				...layout.placements,
				{
					widget_id: addPreviewWidgetId,
					x: preview.x,
					y: preview.y,
					w: preview.w,
					h: preview.h
				}
			]
		}, { sections: dashboard.sections }).placements;
	});
	const activeAddPreviewPlacement = $derived.by(
		() => addPreviewPlacements.find((placement) => placement.widget_id === addPreviewWidgetId) ?? null
	);
	const layoutSections = $derived.by(() => {
		if (!layout) return [];
		return resolveDashboardSections(layout, (placement) => {
			const widget = widgetById.get(placement.widget_id);
			return widget ? dashboardCardSpec(widget.type).family : 'Section';
		}, dashboard.sections);
	});
	const sectionIdByWidgetId = $derived.by(() => {
		if (!layout) return new Map<string, string | null>();
		return new Map(
			layout.placements.map((placement) => [placement.widget_id, placement.section_id ?? null] as const)
		);
	});
	const collapsedSectionIdSet = $derived(new Set(collapsedSectionIds));
	const selectedSectionId = $derived(
		selectedWidgetId ? sectionIdByWidgetId.get(selectedWidgetId) ?? null : null
	);
	const sectionInsertionLanes = $derived.by(() => {
		const lanes: Array<{
			id: string;
			y: number;
			label: string;
			beforeSectionId?: string | null;
			afterSectionId?: string | null;
		}> = [];
		if (!layout) return [];
		if (layoutSections.length === 0) {
			lanes.push({
				id: 'lane-empty',
				y: 0,
				label: 'Insert first section'
			});
			return lanes;
		}

		lanes.push(
			...layoutSections.map((section) => ({
				id: `lane-before-${section.id}`,
				y: Math.max(0, section.startRow),
				label: `Insert before ${titleCase(section.title)}`,
				beforeSectionId: section.id as string
			}))
		);
		const lastSection = layoutSections[layoutSections.length - 1];
		lanes.push({
			id: `lane-after-${lastSection.id}`,
			y: Math.max(lastSection.y, lastSection.startRow + lastSection.rowSpan + 1),
			label: `Insert after ${titleCase(lastSection.title)}`,
			afterSectionId: lastSection.id as string
		});
		return lanes;
	});

	$effect(() => {
		const element = gridEl;
		if (!element) return;

		const handleClick = (event: MouseEvent) => {
			if (editing && event.target === element && !dragState) {
				menuOpenFor = null;
				sectionMenuOpenFor = null;
				onClearSelection?.();
			}
		};

		const handleDragOver = (event: DragEvent) => {
			if (!editing) return;
			const type = event.dataTransfer?.getData(
				'application/x-homecore-dashboard-card'
			) as DashboardWidgetType;
			const preview = type ? addPreviewPlacement(type, event.clientX, event.clientY) : null;
			if (!type || !preview) return;
			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'copy';
			}
			addPreview = preview;
		};

		const handleDragLeave = (event: DragEvent) => {
			if (!editing) return;
			if (event.currentTarget === event.target) {
				addPreview = null;
			}
		};

		const handleDrop = (event: DragEvent) => {
			if (!editing) return;
			const type = event.dataTransfer?.getData(
				'application/x-homecore-dashboard-card'
			) as DashboardWidgetType;
			if (!type) return;
			const preview = addPreviewPlacement(type, event.clientX, event.clientY);
			event.preventDefault();
			if (preview) {
				onAddWidget?.(type, breakpoint, {
					x: preview.x,
					y: preview.y,
					w: preview.w,
					h: preview.h
				});
			}
			addPreview = null;
		};

		element.addEventListener('click', handleClick);
		element.addEventListener('dragover', handleDragOver);
		element.addEventListener('dragleave', handleDragLeave);
		element.addEventListener('drop', handleDrop);
		return () => {
			element.removeEventListener('click', handleClick);
			element.removeEventListener('dragover', handleDragOver);
			element.removeEventListener('dragleave', handleDragLeave);
			element.removeEventListener('drop', handleDrop);
		};
	});

	function cellMetrics() {
		if (!gridEl || !layout) return null;
		const rect = gridEl.getBoundingClientRect();
		const gap = layout.gap;
		const columnWidth = (rect.width - gap * (layout.columns - 1)) / layout.columns;
		const rowHeight = layout.row_height;
		return { rect, gap, columnWidth, rowHeight };
	}

	function previewPlacementFromPoint(clientX: number, clientY: number) {
		if (!layout || !gridEl) return null;
		const metrics = cellMetrics();
		if (!metrics) return null;
		const localX = clientX - metrics.rect.left;
		const localY = clientY - metrics.rect.top;
		const x = Math.max(
			0,
			Math.min(layout.columns - 1, Math.floor(localX / (metrics.columnWidth + metrics.gap)))
		);
		const y = Math.max(0, Math.floor(localY / (metrics.rowHeight + metrics.gap)));
		return { x, y };
	}

	function addPreviewPlacement(type: DashboardWidgetType, clientX: number, clientY: number) {
		const anchor = previewPlacementFromPoint(clientX, clientY);
		if (!layout || !anchor) return null;
		const spec = dashboardCardSpec(type);
		return {
			type,
			x: anchor.x,
			y: anchor.y,
			w: Math.max(spec.minWidth, Math.min(spec.preferredWidth, layout.columns)),
			h: spec.minHeight
		};
	}

	function beginDrag(
		event: PointerEvent,
		placement: { widget_id: string; x: number; y: number; w: number; h: number },
		mode: 'move' | 'resize'
	) {
		event.preventDefault();
		event.stopPropagation();
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			target.setPointerCapture(event.pointerId);
		}
		menuOpenFor = null;
		sectionMenuOpenFor = null;
		onSelect?.(placement.widget_id);
		dragState = {
			widgetId: placement.widget_id,
			mode,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: placement.x,
			originY: placement.y,
			originW: placement.w,
			originH: placement.h,
			previewX: placement.x,
			previewY: placement.y,
			previewW: placement.w,
			previewH: placement.h
		};
	}

	function updateDrag(event: PointerEvent) {
		if (!dragState || !layout || event.pointerId !== dragState.pointerId) return;
		const metrics = cellMetrics();
		if (!metrics) return;
		const deltaX = event.clientX - dragState.startX;
		const deltaY = event.clientY - dragState.startY;
		const stepX = Math.round(deltaX / (metrics.columnWidth + metrics.gap));
		const stepY = Math.round(deltaY / (metrics.rowHeight + metrics.gap));

		if (dragState.mode === 'move') {
			dragState = {
				...dragState,
				previewX: dragState.originX + stepX,
				previewY: dragState.originY + stepY,
				previewW: dragState.originW,
				previewH: dragState.originH
			};
			return;
		}

		dragState = {
			...dragState,
			previewX: dragState.originX,
			previewY: dragState.originY,
			previewW: dragState.originW + stepX,
			previewH: dragState.originH + stepY
		};
	}

	function endDrag() {
		if (dragState) {
			const currentDrag = dragState;
			const previewTargetSectionId =
				currentDrag.mode === 'move'
					? layoutSections.find(
							(section) =>
								currentDrag.previewY >= section.startRow &&
								currentDrag.previewY < section.startRow + section.rowSpan
						)?.id ?? null
					: null;
			const currentSectionId = sectionIdByWidgetId.get(currentDrag.widgetId) ?? null;
			if (
				currentDrag.mode === 'move' &&
				previewTargetSectionId &&
				previewTargetSectionId !== currentSectionId
			) {
				onMoveWidgetToSection?.(currentDrag.widgetId, previewTargetSectionId, {
					x: currentDrag.previewX,
					y: currentDrag.previewY,
					w: currentDrag.previewW,
					h: currentDrag.previewH
				});
			} else {
				onSetPlacement?.(currentDrag.widgetId, breakpoint, {
					x: currentDrag.previewX,
					y: currentDrag.previewY,
					w: currentDrag.previewW,
					h: currentDrag.previewH
				});
			}
		}
		dragState = null;
	}

	function cancelDrag() {
		dragState = null;
	}

	function toggleMenu(event: MouseEvent, widgetId: string) {
		event.preventDefault();
		event.stopPropagation();
		onSelect?.(widgetId);
		sectionMenuOpenFor = null;
		menuOpenFor = menuOpenFor === widgetId ? null : widgetId;
	}

	function toggleSectionMenu(event: MouseEvent, sectionId: string) {
		event.preventDefault();
		event.stopPropagation();
		menuOpenFor = null;
		sectionMenuOpenFor = sectionMenuOpenFor === sectionId ? null : sectionId;
	}

	function closeMenus() {
		menuOpenFor = null;
		sectionMenuOpenFor = null;
	}

	function openAddAtSection(
		event: MouseEvent,
		section: { id: string; x: number; y: number; title: string }
	) {
		event.preventDefault();
		event.stopPropagation();
		menuOpenFor = null;
		sectionMenuOpenFor = null;
		onOpenAddAtSection?.({
			breakpoint,
			x: section.x,
			y: section.y,
			label: titleCase(section.title),
			section_id: section.id
		});
	}

	function insertSection(
		event: MouseEvent,
		options: { beforeSectionId?: string | null; afterSectionId?: string | null; y?: number }
	) {
		event.preventDefault();
		event.stopPropagation();
		menuOpenFor = null;
		sectionMenuOpenFor = null;
		onInsertSection?.(options);
	}

	function focusCanvasSection(event: MouseEvent, sectionId: string, firstWidgetId: string) {
		event.preventDefault();
		event.stopPropagation();
		menuOpenFor = null;
		sectionMenuOpenFor = null;
		if (firstWidgetId) {
			onSelect?.(firstWidgetId);
		}
		onFocusSection?.(sectionId);
	}

	function runMenuAction(widgetId: string, action: () => void) {
		onSelect?.(widgetId);
		action();
		menuOpenFor = null;
		sectionMenuOpenFor = null;
	}

	function runSectionMenuAction(sectionId: string, action: () => void) {
		action();
		sectionMenuOpenFor = null;
		menuOpenFor = null;
		if (focusedSectionId !== sectionId) {
			onFocusSection?.(sectionId);
		}
	}

	function editSection(event: MouseEvent, sectionId: string) {
		event.preventDefault();
		event.stopPropagation();
		menuOpenFor = null;
		sectionMenuOpenFor = null;
		onEditSection?.(sectionId);
	}

	function makePlacementFullWidth(placement: DashboardWidgetPlacement) {
		onSelect?.(placement.widget_id);
		onSetPlacement?.(placement.widget_id, breakpoint, {
			x: 0,
			y: placement.y,
			w: layout?.columns ?? placement.w,
			h: placement.h
		});
		menuOpenFor = null;
		sectionMenuOpenFor = null;
	}

	function handleLostPointerCapture(event: PointerEvent) {
		if (dragState && event.pointerId === dragState.pointerId) {
			endDrag();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (editing && event.key === 'Escape' && (menuOpenFor || sectionMenuOpenFor)) {
			event.preventDefault();
			closeMenus();
			return;
		}

		if (editing && event.key === 'Escape' && dragState) {
			event.preventDefault();
			cancelDrag();
		}

	}

</script>

<svelte:window
	bind:innerWidth={width}
	onkeydown={handleWindowKeydown}
	onpointermove={updateDrag}
	onpointerup={endDrag}
	onpointercancel={endDrag}
	onblur={cancelDrag}
/>

{#if !layout}
	<p>No dashboard layout available.</p>
{:else}
	<div class="grid-shell">
		<div
			bind:this={gridEl}
			class="grid"
			style={`--columns:${layout.columns}; --row-height:${layout.row_height}px; --gap:${layout.gap}px;`}
		>
			{#if editing}
				{#each sectionInsertionLanes as lane (lane.id)}
					<div
						class="section-insert-lane"
						style={`grid-column:1 / -1; grid-row:${lane.y + 1} / span 1;`}
					>
						<button
							type="button"
							class="section-insert-button"
							onclick={(event) =>
								insertSection(event, {
									beforeSectionId: lane.beforeSectionId ?? null,
									afterSectionId: lane.afterSectionId ?? null,
									y: lane.y
								})}
						>
							<span class="section-insert-line" aria-hidden="true"></span>
							<span>{lane.label}</span>
						</button>
					</div>
				{/each}
				{#each layoutSections as section (section.id)}
						<div
							class:muted={!!focusedSectionId && section.id !== focusedSectionId}
							class:active={focusedSectionId === section.id}
							class="section-band"
							style={`grid-column:1 / -1; grid-row:${section.startRow + 1} / span ${section.rowSpan};`}
						>
						<div class="section-label">
							<strong>{titleCase(section.title)}</strong>
							<span>
								{section.cardCount} {section.cardCount === 1 ? 'card' : 'cards'}
								{#if collapsedSectionIdSet.has(section.id)}
									· collapsed
								{/if}
								{#if hiddenSectionIdSet.has(section.id)}
									· hidden
								{/if}
								· row {section.startRow}
							</span>
							<div class="section-actions">
								<button
									type="button"
									class="section-action quiet"
									onclick={(event) => focusCanvasSection(event, section.id, section.firstWidgetId)}
								>
									Select
								</button>
								<button
									type="button"
									class="section-action"
									onclick={(event) => openAddAtSection(event, section)}
								>
									Add
								</button>
								<button
									type="button"
									class="section-menu-handle"
									aria-label="Section actions"
									aria-expanded={sectionMenuOpenFor === section.id}
									title="Section actions"
									onclick={(event) => toggleSectionMenu(event, section.id)}
								>
									···
								</button>
								{#if sectionMenuOpenFor === section.id}
									<div class="section-menu" role="menu">
										<button
											type="button"
											role="menuitem"
											onclick={(event) => editSection(event, section.id)}
										>
											Section details
										</button>
										<button
											type="button"
											role="menuitem"
											onclick={() =>
												runSectionMenuAction(section.id, () => onToggleSectionCollapsed?.(section.id))}
										>
											{collapsedSectionIdSet.has(section.id) ? 'Expand section' : 'Collapse section'}
										</button>
										{#if selectedWidgetId && selectedSectionId !== section.id}
											<button
												type="button"
												role="menuitem"
												onclick={() =>
													runSectionMenuAction(section.id, () =>
														onMoveWidgetToSection?.(selectedWidgetId, section.id)
													)}
											>
												Move selected card here
											</button>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			{/if}
			{#if editing && addPreview && activeAddPreviewPlacement}
				<div
					class="lane-preview add-lane"
					style={`grid-column:${activeAddPreviewPlacement.x + 1} / span ${activeAddPreviewPlacement.w}; grid-row:1 / 999;`}
				></div>
				<div
					class="row-preview add-row"
					style={`grid-column:1 / -1; grid-row:${activeAddPreviewPlacement.y + 1} / span ${activeAddPreviewPlacement.h};`}
				></div>
				{#each addPreviewPlacements as placement (placement.widget_id)}
					<div
						class={`placement preview add-preview ${placement.widget_id === addPreviewWidgetId ? 'active-preview' : 'ghost-preview'}`}
						style={`grid-column:${placement.x + 1} / span ${placement.w}; grid-row:${placement.y + 1} / span ${placement.h};`}
					>
						<div class="preview-inner">
							{#if placement.widget_id === addPreviewWidgetId}
								<div class="preview-anchor">
									<strong>Drop Here</strong>
									<span>Col {placement.x + 1} Row {placement.y + 1}</span>
								</div>
							{/if}
							<span>
								{#if placement.widget_id === addPreviewWidgetId}
									Add {addPreview.type}
								{:else}
									Shift
								{/if}
							</span>
						</div>
					</div>
				{/each}
			{/if}
			{#each layout.placements as placement (placement.widget_id)}
				{@const widget = widgetById.get(placement.widget_id)}
				{#if widget}
					{@const sectionId = sectionIdByWidgetId.get(placement.widget_id)}
					{#if !sectionId || (!collapsedSectionIdSet.has(sectionId) && !hiddenSectionIdSet.has(sectionId))}
						<div
							class:previewing={editing && (!!dragState || !!addPreview)}
							class:dragging={dragState?.widgetId === placement.widget_id}
							class:selected={editing && selectedWidgetId === placement.widget_id}
							class:muted={!!focusedSectionId && sectionId !== focusedSectionId}
							class="placement"
						style={`grid-column:${placement.x + 1} / span ${placement.w}; grid-row:${placement.y + 1} / span ${placement.h};`}
					>
						{#if editing}
							<button
								type="button"
								class="select-surface"
								aria-label={`Select ${widget.title}`}
								aria-pressed={selectedWidgetId === placement.widget_id}
								onclick={() => onSelect?.(placement.widget_id)}
								ondblclick={() => onInspect?.(placement.widget_id)}
							></button>
						{/if}
						{#if editing && selectedWidgetId === placement.widget_id}
							<div class="selection-frame">
								<div class="selection-outline" aria-hidden="true"></div>
								<button
									type="button"
									class="drag-handle"
									aria-label="Drag card"
									title="Move card"
									onpointerdown={(event) => beginDrag(event, placement, 'move')}
									onlostpointercapture={handleLostPointerCapture}
								>
									::
								</button>
								<button
									type="button"
									class="menu-handle"
									aria-label="Card actions"
									aria-expanded={menuOpenFor === placement.widget_id}
									title="Card actions"
									onclick={(event) => toggleMenu(event, placement.widget_id)}
								>
									···
								</button>
								{#if menuOpenFor === placement.widget_id}
									<div class="card-menu" role="menu">
										<button
											type="button"
											role="menuitem"
											onclick={() => runMenuAction(placement.widget_id, () => onInspect?.(placement.widget_id))}
										>
											Edit card
										</button>
										<button
											type="button"
											role="menuitem"
											onclick={() => makePlacementFullWidth(placement)}
										>
											Make full width
										</button>
										<button
											type="button"
											role="menuitem"
											onclick={() =>
												runMenuAction(placement.widget_id, () =>
													onMoveWidgetToAdjacentSection?.(placement.widget_id, -1)
												)}
										>
											Move to previous section
										</button>
										<button
											type="button"
											role="menuitem"
											onclick={() =>
												runMenuAction(placement.widget_id, () =>
													onMoveWidgetToAdjacentSection?.(placement.widget_id, 1)
												)}
										>
											Move to next section
										</button>
										<button
											type="button"
											role="menuitem"
											onclick={() => runMenuAction(placement.widget_id, () => onDuplicate?.(placement.widget_id))}
										>
											Duplicate
										</button>
										<button
											type="button"
											role="menuitem"
											class="danger"
											onclick={() => runMenuAction(placement.widget_id, () => onDelete?.(placement.widget_id))}
										>
											Delete
										</button>
									</div>
								{/if}
							</div>
						{/if}
						<DashboardWidget {dashboard} {layout} {widget} {devices} {scenes} {modes} {events} />
					</div>
					{/if}
				{/if}
			{/each}

				{#if editing && dragState}
					{#if activePreviewPlacement}
						<div
							class={`lane-preview ${dragState.mode === 'resize' ? 'resize-lane' : 'move-lane'}`}
							style={`grid-column:${activePreviewPlacement.x + 1} / span ${activePreviewPlacement.w}; grid-row:1 / 999;`}
						></div>
						<div
							class={`row-preview ${dragState.mode === 'resize' ? 'resize-row' : 'move-row'}`}
							style={`grid-column:1 / -1; grid-row:${activePreviewPlacement.y + 1} / span ${activePreviewPlacement.h};`}
						></div>
					{/if}
					{#each previewPlacements as placement (placement.widget_id)}
						<div
							class={`placement preview ${dragState.mode === 'resize' ? 'resize-preview' : 'move-preview'} ${placement.widget_id === dragState.widgetId ? 'active-preview' : 'ghost-preview'}`}
							style={`grid-column:${placement.x + 1} / span ${placement.w}; grid-row:${placement.y + 1} / span ${placement.h};`}
						>
							<div class="preview-inner">
								<span>
									{#if placement.widget_id === dragState.widgetId}
										{dragState.mode === 'resize' ? 'Resize Preview' : 'Drop Preview'}
									{:else}
										Shift
									{/if}
								</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			{#if showSelectionHint}
				<div class="selection-hint">
					<strong>Canvas ready</strong>
					<span>Select a card or use Add to compose this section.</span>
				</div>
			{/if}
		</div>
	{/if}

<style>
	.grid-shell {
		position: relative;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		grid-auto-rows: var(--row-height);
		gap: var(--gap);
		align-items: stretch;
	}

	.placement {
		min-width: 0;
		min-height: 0;
		position: relative;
	}

	.placement.selected {
		z-index: 3;
	}

	.placement.dragging {
		opacity: 0.28;
		filter: saturate(0.7);
	}

	.placement.previewing:not(.dragging) {
		opacity: 0.42;
		filter: saturate(0.78);
	}

	.placement.muted:not(.selected):not(.dragging) {
		opacity: 0.22;
		filter: saturate(0.55);
	}

	.preview {
		pointer-events: none;
		z-index: 1;
	}

	.section-band {
		pointer-events: none;
		z-index: 0;
		position: relative;
		margin: -0.2rem 0;
		border-radius: 0.7rem;
		background: color-mix(in srgb, var(--hc-surface-soft) 84%, transparent);
		border: 1px solid var(--hc-border);
	}

	.section-band.muted {
		opacity: 0.35;
	}

	.section-band.active {
		background: var(--hc-surface-soft);
		border-color: var(--hc-border-strong);
	}

	.section-insert-lane {
		z-index: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 1.25rem;
	}

	.section-insert-button {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.18rem 0.6rem;
		border-radius: 0.45rem;
		border: 1px dashed var(--hc-border-strong);
		background: var(--hc-surface);
		color: var(--hc-text-muted);
		font: inherit;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.section-insert-line {
		width: 2.5rem;
		height: 1px;
		background: rgba(122, 145, 164, 0.72);
	}

	.section-label {
		position: sticky;
		top: 0.45rem;
		left: 0.55rem;
		width: fit-content;
		display: grid;
		gap: 0.06rem;
		margin: 0.55rem;
		padding: 0.38rem 0.58rem;
		border-radius: 0.45rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
	}

	.section-label strong {
		font-size: 0.69rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #48657f;
	}

	.section-label span {
		font-size: 0.72rem;
		color: #6c7f92;
	}

	.section-action {
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text-muted);
		border-radius: 0.35rem;
		padding: 0.18rem 0.42rem;
		font: inherit;
		font-size: 0.66rem;
		font-weight: 600;
		width: fit-content;
		pointer-events: auto;
	}

	.section-action.quiet {
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
	}

	.section-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.28rem;
		margin-top: 0.22rem;
		position: relative;
	}

	.lane-preview,
	.row-preview {
		pointer-events: none;
		z-index: 0;
		border-radius: 1rem;
	}

	.lane-preview {
		background: linear-gradient(180deg, rgba(95, 154, 207, 0.16), rgba(95, 154, 207, 0.05));
		outline: 1px solid rgba(83, 142, 193, 0.32);
	}

	.row-preview {
		background: linear-gradient(90deg, rgba(106, 168, 209, 0.1), rgba(106, 168, 209, 0.04));
		outline: 1px dashed rgba(93, 146, 192, 0.22);
	}

	.resize-lane {
		background: linear-gradient(180deg, rgba(77, 171, 181, 0.16), rgba(77, 171, 181, 0.05));
		outline-color: rgba(62, 146, 155, 0.32);
	}

	.add-lane {
		background: linear-gradient(180deg, rgba(84, 181, 108, 0.16), rgba(84, 181, 108, 0.05));
		outline-color: rgba(61, 139, 86, 0.32);
	}

	.resize-row {
		background: linear-gradient(90deg, rgba(77, 171, 181, 0.1), rgba(77, 171, 181, 0.04));
		outline-color: rgba(62, 146, 155, 0.22);
	}

	.add-row {
		background: linear-gradient(90deg, rgba(84, 181, 108, 0.1), rgba(84, 181, 108, 0.04));
		outline-color: rgba(61, 139, 86, 0.22);
	}

	.preview-inner {
		height: 100%;
		border-radius: 0.65rem;
		border: 2px dashed rgba(63, 113, 159, 0.72);
		background: rgba(120, 167, 210, 0.16);
		display: grid;
		place-items: center;
		position: relative;
		color: #25557e;
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		backdrop-filter: blur(2px);
	}

	.preview-anchor {
		position: absolute;
		top: 0.7rem;
		left: 0.7rem;
		display: grid;
		gap: 0.08rem;
		padding: 0.38rem 0.55rem;
		border-radius: 0.45rem;
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid rgba(61, 139, 86, 0.28);
		text-align: left;
	}

	.preview-anchor strong {
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #25683a;
	}

	.preview-anchor span {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: #447553;
	}

	.resize-preview .preview-inner {
		border-color: rgba(51, 124, 137, 0.72);
		background: rgba(83, 172, 177, 0.16);
		color: #1d6c73;
	}

	.ghost-preview .preview-inner {
		border-style: dotted;
		background: rgba(134, 152, 171, 0.12);
		color: #536b81;
	}

	.add-preview .preview-inner {
		border-style: solid;
		border-color: rgba(61, 139, 86, 0.62);
		background: rgba(84, 181, 108, 0.12);
		color: #25683a;
	}

	.select-surface {
		position: absolute;
		inset: 0;
		z-index: 1;
		border: 0;
		background: transparent;
		border-radius: 1rem;
		cursor: pointer;
	}

	.select-surface:focus-visible {
		outline: 2px solid rgba(86, 135, 181, 0.46);
		outline-offset: 3px;
	}

	.drag-handle,
	.menu-handle,
	.section-menu-handle {
		position: absolute;
		z-index: 4;
		border: 1px solid var(--hc-border);
		background: color-mix(in srgb, var(--hc-surface) 92%, white);
		color: var(--hc-text-muted);
		border-radius: 0.35rem;
		padding: 0.12rem 0.28rem;
		font: inherit;
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1;
		touch-action: none;
		user-select: none;
		opacity: 0;
		transition: opacity 140ms ease, background-color 140ms ease;
	}

	.drag-handle {
		top: -0.55rem;
		left: -0.55rem;
	}

	.menu-handle {
		top: -0.55rem;
		right: -0.55rem;
	}

	.section-menu-handle {
		position: static;
		opacity: 1;
		padding-inline: 0.38rem;
	}

	.selection-frame {
		position: absolute;
		inset: -0.45rem;
		pointer-events: none;
		z-index: 3;
	}

	.selection-outline {
		position: absolute;
		inset: 0;
		border-radius: 1.2rem;
		border: 1px solid color-mix(in srgb, var(--hc-accent) 35%, var(--hc-border));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--hc-surface) 92%, white) inset;
	}

	.selection-frame .drag-handle,
	.selection-frame .menu-handle {
		pointer-events: auto;
	}

	.placement.selected .select-surface,
	.placement:hover .select-surface {
		opacity: 0.92;
	}

	.placement.selected .select-surface {
		opacity: 1;
	}

	.placement.selected .selection-frame .drag-handle,
	.placement.selected .selection-frame .menu-handle {
		opacity: 0.82;
	}

	.placement:hover .selection-frame .drag-handle,
	.placement:hover .selection-frame .menu-handle {
		opacity: 0.62;
	}

	.card-menu {
		position: absolute;
		top: 0.75rem;
		right: 0;
		z-index: 5;
		min-width: 10rem;
		display: grid;
		gap: 0.12rem;
		padding: 0.28rem;
		border-radius: 0.4rem;
		border: 1px solid var(--hc-border);
		background: color-mix(in srgb, var(--hc-surface) 96%, white);
		pointer-events: auto;
	}

	.section-menu {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		z-index: 5;
		min-width: 10.5rem;
		display: grid;
		gap: 0.12rem;
		padding: 0.28rem;
		border-radius: 0.4rem;
		border: 1px solid var(--hc-border);
		background: color-mix(in srgb, var(--hc-surface) 96%, white);
		pointer-events: auto;
		box-shadow: 0 8px 22px rgba(16, 34, 48, 0.08);
	}

	.card-menu button,
	.section-menu button {
		border: 0;
		background: transparent;
		border-radius: 0.32rem;
		padding: 0.36rem 0.48rem;
		font: inherit;
		font-size: 0.72rem;
		color: var(--hc-text);
		text-align: left;
	}

	.card-menu button:hover,
	.section-menu button:hover {
		background: var(--hc-surface-soft);
	}

	.card-menu button.danger {
		color: #a04133;
	}

	.selection-frame .drag-handle:hover,
	.selection-frame .menu-handle:hover {
		background: rgba(255, 255, 255, 0.98);
	}

	.selection-hint {
		position: absolute;
		left: 1rem;
		bottom: 1rem;
		display: grid;
		gap: 0.08rem;
		max-width: 16rem;
		padding: 0.5rem 0.62rem;
		border-radius: 0.4rem;
		border: 1px solid var(--hc-border);
		background: color-mix(in srgb, var(--hc-surface) 94%, white);
	}

	.selection-hint strong {
		font-size: 0.76rem;
		color: var(--hc-text);
	}

	.selection-hint span {
		font-size: 0.72rem;
		color: var(--hc-text-muted);
	}
</style>
