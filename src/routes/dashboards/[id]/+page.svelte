<script lang="ts">
	import { browser } from '$app/environment';
	import { beforeNavigate, goto } from '$app/navigation';
	import DashboardCardCatalog from '$lib/components/dashboard/DashboardCardCatalog.svelte';
	import DashboardGrid from '$lib/components/dashboard/DashboardGrid.svelte';
	import DashboardSectionEditor from '$lib/components/dashboard/DashboardSectionEditor.svelte';
	import DashboardWidgetInspector from '$lib/components/dashboard/DashboardWidgetInspector.svelte';
	import { listDevices } from '$lib/api/devices';
	import { listScenes } from '$lib/api/scenes';
	import { listModes } from '$lib/api/modes';
	import { createDashboardEditorState } from '$lib/stores/dashboardEditor.svelte';
	import { dashboardsState } from '$lib/stores/dashboards.svelte';
	import { eventsState } from '$lib/stores/events.svelte';
	import { dashboardCardSpec } from '$lib/models/dashboardCards';
	import { DASHBOARD_BREAKPOINTS } from '$lib/models/dashboard';
	import { resolveDashboardSections } from '$lib/models/dashboardLayout';
	import type {
		DashboardBreakpoint,
		DashboardDefinition,
		DashboardWidgetPlacement,
		DashboardWidgetType
	} from '$lib/models/dashboard';
	import type { DeviceState } from '$lib/models/device';
	import type { Scene } from '$lib/models/scene';
	import type { ModeState } from '$lib/models/mode';
	import { titleCase } from '$lib/utils/formatting';

	let { params }: { params: { id: string } } = $props();

	let dashboard = $state<DashboardDefinition | null>(null);
	let devices = $state<DeviceState[]>([]);
	let scenes = $state<Scene[]>([]);
	let modes = $state<ModeState[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let editor = $state<ReturnType<typeof createDashboardEditorState> | null>(null);
	let editMode = $state(false);
	let catalogAnchor = $state<{
		breakpoint: DashboardBreakpoint;
		x: number;
		y: number;
		label: string;
		section_id?: string | null;
	} | null>(null);
	let focusedSectionId = $state<string | null>(null);
	let sectionEditorId = $state<string | null>(null);

	$effect(() => {
		void (async () => {
			loading = true;
			error = null;
			try {
				await dashboardsState.ensureLoaded();
				dashboard = dashboardsState.getById(params.id);
				if (!dashboard) {
					throw new Error('Dashboard not found');
				}
				editor = createDashboardEditorState(dashboard);
				const [loadedDevices, loadedScenes, loadedModes] = await Promise.all([
					listDevices(),
					listScenes(),
					listModes()
				]);
				devices = loadedDevices;
				scenes = loadedScenes;
				modes = loadedModes;
				if (browser) {
					eventsState.connect();
				}
			} catch (value) {
				error = value instanceof Error ? value.message : 'Unable to load dashboard';
			} finally {
				loading = false;
			}
		})();
	});

	beforeNavigate((navigation) => {
		if (!browser || !editMode || !editor?.dirty) return;
		if (navigation.to?.route?.id === navigation.from?.route?.id) return;
		if (!window.confirm('Discard unsaved dashboard changes?')) {
			navigation.cancel();
		}
	});

	$effect(() => {
		if (!browser || !editMode || !editor?.dirty) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	function switchDashboard(event: Event) {
		const target = event.currentTarget as HTMLSelectElement;
		if (target.value) {
			void goto(`/dashboards/${target.value}`);
		}
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		if (target.isContentEditable) return true;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.closest('input, textarea, select, [contenteditable="true"]');
	}

	function handleEditorKeydown(event: KeyboardEvent) {
		if (!editor || !editMode || isEditableTarget(event.target)) return;
		const selectedWidgetId = editor.selectedWidget?.id;

		if ((event.metaKey || event.ctrlKey) && event.altKey && event.key === '[') {
			event.preventDefault();
			if (activeFocusedSection) {
				moveFocusedSection(-1);
			}
			return;
		}

		if ((event.metaKey || event.ctrlKey) && event.altKey && event.key === ']') {
			event.preventDefault();
			if (activeFocusedSection) {
				moveFocusedSection(1);
			}
			return;
		}

		if (event.altKey && event.shiftKey && event.key === 'PageUp') {
			event.preventDefault();
			if (activeFocusedSection) {
				editor.nudgeSectionY(activeFocusedSection.id, -1);
			}
			return;
		}

		if (event.altKey && event.shiftKey && event.key === 'PageDown') {
			event.preventDefault();
			if (activeFocusedSection) {
				editor.nudgeSectionY(activeFocusedSection.id, 1);
			}
			return;
		}

		if (event.altKey && event.key === '[') {
			event.preventDefault();
			stepFocusedSection(-1);
			return;
		}

		if (event.altKey && event.key === ']') {
			event.preventDefault();
			stepFocusedSection(1);
			return;
		}

		if ((event.key === '[' && !event.shiftKey) || event.key === 'PageUp') {
			event.preventDefault();
			if (activeFocusedSection && stepFocusedSectionWidget(-1)) return;
			editor.selectPreviousWidget();
			return;
		}

		if ((event.key === ']' && !event.shiftKey) || event.key === 'PageDown') {
			event.preventDefault();
			if (activeFocusedSection && stepFocusedSectionWidget(1)) return;
			editor.selectNextWidget();
			return;
		}

		if (event.key === 'Home') {
			event.preventDefault();
			if (activeFocusedSection && selectFocusedSectionEdge('first')) return;
			editor.selectFirstWidget();
			return;
		}

		if (event.key === 'End') {
			event.preventDefault();
			if (activeFocusedSection && selectFocusedSectionEdge('last')) return;
			editor.selectLastWidget();
			return;
		}

		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedWidgetId) {
			event.preventDefault();
			editor.deleteSelectedWidget();
			return;
		}

		if (event.key === 'Escape') {
			if (selectedWidgetId) {
				event.preventDefault();
				editor.clearSelection();
			} else if (focusedSectionId) {
				event.preventDefault();
				setFocusedSection(null);
			}
			return;
		}

		if (selectedWidgetId && event.altKey && event.shiftKey && event.key === 'ArrowUp') {
			event.preventDefault();
			editor.moveSelectedWidgetToAdjacentSection(-1);
			return;
		}

		if (selectedWidgetId && event.altKey && event.shiftKey && event.key === 'ArrowDown') {
			event.preventDefault();
			editor.moveSelectedWidgetToAdjacentSection(1);
			return;
		}

		if (selectedWidgetId && event.altKey && event.shiftKey && event.key === 'Enter') {
			event.preventDefault();
			moveSelectedToFocusedSection();
			return;
		}

		if (selectedWidgetId && event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
			event.preventDefault();
			inspectWidget(selectedWidgetId);
			return;
		}

		if (!selectedWidgetId) return;

		const field =
			event.key === 'ArrowLeft'
				? 'x'
				: event.key === 'ArrowRight'
					? 'x'
					: event.key === 'ArrowUp'
						? 'y'
						: event.key === 'ArrowDown'
							? 'y'
							: null;
		if (!field) return;

		event.preventDefault();
		const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
		editor.nudgePlacement(
			selectedWidgetId,
			editor.activeBreakpoint,
			event.shiftKey ? (field === 'x' ? 'w' : 'h') : field,
			delta
		);
	}

	const selectionSummary = $derived(editor?.selectedWidget ?? null);
	const selectionPlacement = $derived(editor?.selectedPlacement ?? null);
	const selectionIndex = $derived(editor ? editor.selectedWidgetIndex : -1);
	const activeSections = $derived.by(() => {
		const currentEditor = editor;
		if (!currentEditor?.activeLayout) return [];
		return resolveDashboardSections(currentEditor.activeLayout, (placement) => {
			const widget = currentEditor.dashboard.widgets.find(
				(entry) => entry.id === placement.widget_id
			);
			return widget ? dashboardCardSpec(widget.type).family : 'Section';
		}, currentEditor.activeSections);
	});
	const selectedSectionId = $derived.by(() => {
		const placement = editor?.selectedPlacement;
		if (!placement) return null;
		return (
			activeSections.find(
				(section) =>
					placement.y >= section.startRow && placement.y < section.startRow + section.rowSpan
			)?.id ?? null
		);
	});
	const activeFocusedSection = $derived(
		focusedSectionId ? activeSections.find((section) => section.id === focusedSectionId) ?? null : null
	);
	const focusedSectionWidgetIds = $derived.by(() => {
		const currentEditor = editor;
		const currentSection = activeFocusedSection;
		if (!currentEditor?.activeLayout || !currentSection) return [];
		return currentEditor.activeLayout.placements
			.filter(
				(placement) =>
					placement.y >= currentSection.startRow &&
					placement.y < currentSection.startRow + currentSection.rowSpan
			)
			.sort((left, right) => {
				if (left.y !== right.y) return left.y - right.y;
				if (left.x !== right.x) return left.x - right.x;
				return left.widget_id.localeCompare(right.widget_id);
			})
			.map((placement) => placement.widget_id);
	});
	const effectiveCatalogAnchor = $derived.by(() => {
		if (catalogAnchor) return catalogAnchor;
		if (!activeFocusedSection || !editor) return null;
		return {
			breakpoint: editor.activeBreakpoint,
			x: activeFocusedSection.x,
			y: activeFocusedSection.y,
			label: titleCase(activeFocusedSection.title),
			section_id: activeFocusedSection.id
		};
	});
	const currentDashboard = $derived(editor?.dashboard ?? dashboard);

	$effect(() => {
		if (!editMode || !focusedSectionId || !selectedSectionId) return;
		if (focusedSectionId !== selectedSectionId) {
			focusedSectionId = selectedSectionId;
		}
	});

	function setEditMode(next: boolean) {
		if (!next && editMode && browser && editor?.dirty && !window.confirm('Discard unsaved dashboard changes?')) {
			return;
		}

		editMode = next;
		if (!editor) return;
		if (next) {
			catalogAnchor = null;
			focusedSectionId = null;
			editor.openCatalog();
			if (!editor.selectedWidget && editor.widgets[0]) {
				editor.select(editor.widgets[0].id);
				editor.closeInspector();
			}
			return;
		}
		editor.closeCatalog();
		editor.closeInspector();
		catalogAnchor = null;
		focusedSectionId = null;
		editor.clearSelection();
	}

	async function saveDashboard() {
		if (!editor) return;
		const updated = await editor.save();
		dashboard = updated;
		dashboardsState.mergeDashboard(updated);
	}

	function handleSelectWidget(widgetId: string) {
		if (!editor) return;
		editor.closeCatalog();
		editor.select(widgetId);
		editor.closeInspector();
	}

	function inspectWidget(widgetId: string) {
		if (!editor) return;
		editor.closeCatalog();
		catalogAnchor = null;
		editor.select(widgetId);
		editor.openInspector();
	}

	function duplicateWidget(widgetId: string) {
		if (!editor) return;
		editor.select(widgetId);
		editor.duplicateSelectedWidget();
	}

	function deleteWidget(widgetId: string) {
		if (!editor) return;
		editor.select(widgetId);
		editor.deleteSelectedWidget();
	}

	function closeInspector() {
		if (!editor) return;
		editor.closeInspector();
		editor.clearSelection();
	}

	function openSectionEditor(sectionId: string) {
		if (!editor) return;
		const section = editor.dashboard.sections.find((entry) => entry.id === sectionId);
		if (!section) return;
		editor.setActiveBreakpoint(section.breakpoint);
		editor.closeCatalog();
		editor.closeInspector();
		sectionEditorId = sectionId;
		focusedSectionId = sectionId;
	}

	function closeSectionEditor() {
		sectionEditorId = null;
	}

	function closeCatalog() {
		if (!editor) return;
		editor.closeCatalog();
		catalogAnchor = null;
	}

	function openCatalogAtSection(section: {
		breakpoint: DashboardBreakpoint;
		x: number;
		y: number;
		label: string;
		section_id?: string | null;
	}) {
		if (!editor) return;
		catalogAnchor = section;
		sectionEditorId = section.section_id ?? null;
		editor.openCatalog();
	}

	function openCatalog() {
		if (!editor) return;
		if (activeFocusedSection) {
			catalogAnchor = {
				breakpoint: editor.activeBreakpoint,
				x: activeFocusedSection.x,
				y: activeFocusedSection.y,
				label: titleCase(activeFocusedSection.title),
				section_id: activeFocusedSection.id
			};
		} else {
			catalogAnchor = null;
		}
		sectionEditorId = null;
		editor.openCatalog();
	}

	function createSection() {
		createSectionAt();
	}

	function createSectionAt(options?: { beforeSectionId?: string | null; afterSectionId?: string | null; y?: number }) {
		if (!editor) return;
		const sections = editor.activeSections;
		const beforeIndex = options?.beforeSectionId
			? sections.findIndex((section) => section.id === options.beforeSectionId)
			: -1;
		const afterIndex = options?.afterSectionId
			? sections.findIndex((section) => section.id === options.afterSectionId)
			: -1;
		const order =
			beforeIndex >= 0
				? beforeIndex
				: afterIndex >= 0
					? afterIndex + 1
					: undefined;
		const sectionId = editor.createSection(editor.activeBreakpoint, 'New Section', {
			order,
			y: options?.y
		});
		setFocusedSection(sectionId);
	}

	function moveFocusedSection(delta: number) {
		if (!editor || !activeFocusedSection) return;
		editor.moveSection(activeFocusedSection.id, delta);
	}

	function nudgeFocusedSectionY(delta: number) {
		if (!editor || !activeFocusedSection) return;
		editor.nudgeSectionY(activeFocusedSection.id, delta);
	}

	function toggleSectionCollapsed(sectionId: string) {
		if (!editor) return;
		editor.toggleSectionCollapsed(sectionId);
		if (selectedSectionId === sectionId) {
			editor.clearSelection();
			editor.closeInspector();
		}
		if (focusedSectionId === sectionId && editor.isSectionCollapsed(sectionId)) {
			editor.closeInspector();
		}
	}

	function moveSelectedToFocusedSection() {
		if (!editor?.selectedWidget || !activeFocusedSection) return;
		editor.moveWidgetToSection(editor.selectedWidget.id, activeFocusedSection.id, editor.activeBreakpoint);
	}

	function focusSection(firstWidgetId: string) {
		if (!editor) return;
		editor.select(firstWidgetId);
		editor.closeInspector();
	}

	function stepFocusedSection(delta: number) {
		if (!activeSections.length) return;
		const currentIndex = focusedSectionId
			? activeSections.findIndex((section) => section.id === focusedSectionId)
			: -1;
		const fallbackIndex =
			selectedSectionId ? activeSections.findIndex((section) => section.id === selectedSectionId) : -1;
		const baseIndex = currentIndex >= 0 ? currentIndex : fallbackIndex >= 0 ? fallbackIndex : 0;
		const nextIndex = (baseIndex + delta + activeSections.length) % activeSections.length;
		setFocusedSection(activeSections[nextIndex].id);
	}

	function stepFocusedSectionWidget(delta: number) {
		if (!editor || focusedSectionWidgetIds.length === 0) return false;
		const currentId = editor.selectedWidget?.id;
		const currentIndex = currentId ? focusedSectionWidgetIds.indexOf(currentId) : -1;
		const nextIndex =
			currentIndex >= 0
				? (currentIndex + delta + focusedSectionWidgetIds.length) % focusedSectionWidgetIds.length
				: delta >= 0
					? 0
					: focusedSectionWidgetIds.length - 1;
		editor.select(focusedSectionWidgetIds[nextIndex]);
		editor.closeInspector();
		return true;
	}

	function selectFocusedSectionEdge(edge: 'first' | 'last') {
		if (!editor || focusedSectionWidgetIds.length === 0) return false;
		const widgetId =
			edge === 'first'
				? focusedSectionWidgetIds[0]
				: focusedSectionWidgetIds[focusedSectionWidgetIds.length - 1];
		editor.select(widgetId);
		editor.closeInspector();
		return true;
	}

	function setFocusedSection(sectionId: string | null) {
		focusedSectionId = sectionId;
		if (!sectionId) {
			sectionEditorId = null;
			return;
		}
		const section = activeSections.find((entry) => entry.id === sectionId);
		if (section?.firstWidgetId) {
			focusSection(section.firstWidgetId);
		}
	}

	$effect(() => {
		if (!sectionEditorId) return;
		const exists = editor?.dashboard.sections.some((section) => section.id === sectionEditorId) ?? false;
		if (!exists) {
			sectionEditorId = null;
		}
	});
</script>

<svelte:window onkeydown={handleEditorKeydown} />

{#if loading}
	<p>Loading dashboard…</p>
{:else if error}
	<p class="error">{error}</p>
{:else if currentDashboard}
		<section class="page">
		<div class="heading">
			<div>
				<h1>{currentDashboard.name}</h1>
				<p>{currentDashboard.description ?? 'HomeCore dashboard'}</p>
			</div>
			<div class="heading-actions">
				<div class="top-actions">
					<button
						type="button"
						class={editMode ? 'primary' : 'secondary'}
						onclick={() => setEditMode(!editMode)}
					>
						{editMode ? 'Done Editing' : 'Edit Dashboard'}
					</button>
				</div>
				<label class="switcher">
					<span>Switch dashboard</span>
					<select onchange={switchDashboard} value={currentDashboard.id}>
						{#each dashboardsState.items as item}
							<option value={item.id}>{item.name}</option>
						{/each}
					</select>
				</label>
				<div class="meta">
				{#if currentDashboard.is_default}
					<span class="badge">Default</span>
				{/if}
				{#each currentDashboard.tags as tag}
					<span class="tag">{tag}</span>
				{/each}
				{#if eventsState.connected}
					<span class="live connected">Live events</span>
				{:else}
					<span class="live">Reconnecting events</span>
				{/if}
				{#if editor && editMode}
					<span class="live editor">Editor Groundwork</span>
				{/if}
				</div>
			</div>
		</div>

		{#if editor}
			{@const activeEditor = editor}
			<div class:editing={editMode} class="workspace">
				<div class="canvas-column">
					<section class="canvas-shell">
						<div class="canvas-header">
							<div>
								<p class="canvas-eyebrow">{editMode ? 'Dashboard Composer' : 'Live Preview'}</p>
								<h2>{editMode ? 'Compose Dashboard' : 'Dashboard'}</h2>
								{#if editMode && activeEditor.activeLayout}
									<p class="breakpoint-copy">
										{titleCase(activeEditor.activeBreakpoint)} layout · {activeEditor.activeLayout.columns}
										columns · {activeEditor.activeLayout.placements.length} cards
									</p>
								{:else}
									<p class="breakpoint-copy">
										View mode keeps the dashboard clean. Enter compose mode only when you want to change cards or sections.
									</p>
								{/if}
							</div>
							{#if editMode}
								<div class="canvas-actions">
									<div class="composer-toolbar">
										<div class="composer-primary">
											<button type="button" class="secondary" onclick={openCatalog}>
												{activeFocusedSection ? 'Add To Section' : 'Add Card'}
											</button>
											<button
												type="button"
												class="secondary"
												onclick={() => {
													if (selectionSummary?.id) {
														inspectWidget(selectionSummary.id);
													} else if (activeFocusedSection) {
														openSectionEditor(activeFocusedSection.id);
													}
												}}
												disabled={!selectionSummary && !activeFocusedSection}
											>
												{selectionSummary ? 'Edit Card' : 'Edit Section'}
											</button>
											<button type="button" class="secondary" onclick={createSection}>
												New Section
											</button>
										</div>
										<div class="composer-status">
											<span class="selection-chip">
												{selectionSummary
													? `${selectionSummary.title} · ${titleCase(selectionSummary.type)}`
													: activeFocusedSection
														? `${titleCase(activeFocusedSection.title)} selected`
														: 'Select a card or section'}
											</span>
											<div class="toolbar-group breakpoint-summary" role="list" aria-label="Dashboard breakpoints">
												{#each activeEditor.dashboard.layouts as layout (layout.breakpoint)}
													<div role="listitem">
														<button
															type="button"
															class:active={activeEditor.activeBreakpoint === layout.breakpoint}
															class="breakpoint-pill"
															onclick={() => activeEditor.setActiveBreakpoint(layout.breakpoint)}
														>
															<strong>{layout.breakpoint}</strong>
															<span>{layout.columns} cols</span>
														</button>
													</div>
												{/each}
											</div>
										</div>
										<div class="composer-actions">
											<button type="button" class="secondary" disabled={!activeEditor.canUndo || activeEditor.saving} onclick={() => activeEditor.undo()}>
												Undo
											</button>
											<button type="button" class="secondary" disabled={!activeEditor.canRedo || activeEditor.saving} onclick={() => activeEditor.redo()}>
												Redo
											</button>
											<button type="button" class="secondary" disabled={!activeEditor.dirty || activeEditor.saving} onclick={() => activeEditor.reset()}>
												Discard
											</button>
											<button type="button" class="primary" disabled={!activeEditor.dirty || activeEditor.saving} onclick={() => void saveDashboard()}>
												{activeEditor.saving ? 'Saving…' : 'Save'}
											</button>
										</div>
										{#if activeEditor.saveMessage}
											<span class="status saved">{activeEditor.saveMessage}</span>
										{/if}
										{#if activeEditor.saveError}
											<span class="status error">{activeEditor.saveError}</span>
										{/if}
									</div>
								</div>
							{/if}
						</div>

						{#if editMode && activeSections.length > 0}
							<div class="section-strip" aria-label="Layout sections">
								{#each activeSections as section (section.id)}
									<div class:active={focusedSectionId === section.id || selectedSectionId === section.id} class="section-chip">
										<button
											type="button"
											class="section-focus"
											onclick={() => setFocusedSection(section.id)}
										>
											<strong>{titleCase(section.title)}</strong>
											<span>
												{section.cardCount} {section.cardCount === 1 ? 'card' : 'cards'} · {titleCase(
													activeEditor.activeSections.find((entry) => entry.id === section.id)?.layout_policy ?? 'grid'
												)}
											</span>
										</button>
										<button
											type="button"
											class="section-add"
											onclick={() =>
												openCatalogAtSection({
													breakpoint: activeEditor.activeBreakpoint,
													x: section.x,
													y: section.y,
													label: titleCase(section.title),
													section_id: section.id
												})}
										>
											Add
										</button>
										<button
											type="button"
											class="section-edit"
											onclick={() => openSectionEditor(section.id)}
										>
											Edit
										</button>
									</div>
								{/each}
							</div>
						{/if}

						<DashboardGrid
							dashboard={activeEditor.dashboard}
							{devices}
							{scenes}
							{modes}
								events={eventsState.items}
							editing={editMode}
							selectedWidgetId={activeEditor.selectedWidget?.id ?? null}
							activeBreakpoint={activeEditor.activeBreakpoint}
							collapsedSectionIds={activeEditor.collapsedSectionIds}
							onSelect={handleSelectWidget}
							onInspect={inspectWidget}
							onDuplicate={duplicateWidget}
							onDelete={deleteWidget}
							onOpenAddAtSection={openCatalogAtSection}
							onEditSection={openSectionEditor}
							onFocusSection={setFocusedSection}
							onToggleSectionCollapsed={toggleSectionCollapsed}
							onInsertSection={(options) => createSectionAt(options)}
							onMoveWidgetToSection={(widgetId, sectionId, placement) =>
								activeEditor.moveWidgetToSection(
									widgetId,
									sectionId,
									activeEditor.activeBreakpoint,
									placement
								)}
							onMoveWidgetToAdjacentSection={(widgetId, delta) => {
								activeEditor.select(widgetId);
								activeEditor.moveSelectedWidgetToAdjacentSection(delta);
							}}
							focusedSectionId={focusedSectionId}
							onClearSelection={() => activeEditor.clearSelection()}
							onAddWidget={(type: DashboardWidgetType, breakpoint: DashboardBreakpoint, placement: Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'>) =>
								activeEditor.addWidgetAtBreakpoint(type, breakpoint, placement)}
							onNudge={(widgetId: string, breakpoint: DashboardBreakpoint, field: 'x' | 'y' | 'w' | 'h', delta: number) =>
								activeEditor.nudgePlacement(widgetId, breakpoint, field, delta)}
							onSetPlacement={(widgetId: string, breakpoint: DashboardBreakpoint, placement: Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'>) =>
								activeEditor.setPlacement(widgetId, breakpoint, placement)}
						/>
					</section>
				</div>

				{#if editMode && activeEditor.inspectorOpen && activeEditor.selectedWidget}
					<div
						class="inspector-overlay"
						role="presentation"
						onpointerdown={closeInspector}
					>
						<div
							class="inspector-sheet"
							role="dialog"
							aria-label="Card inspector"
							tabindex="-1"
							onpointerdown={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<DashboardWidgetInspector editor={activeEditor} />
						</div>
					</div>
				{/if}

				{#if editMode && sectionEditorId}
					<div
						class="inspector-overlay"
						role="presentation"
						onpointerdown={closeSectionEditor}
					>
						<div
							class="inspector-sheet"
							role="dialog"
							aria-label="Section editor"
							tabindex="-1"
							onpointerdown={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<DashboardSectionEditor
								editor={activeEditor}
								sectionId={sectionEditorId}
								onClose={closeSectionEditor}
								onInspectWidget={(widgetId) => {
									closeSectionEditor();
									inspectWidget(widgetId);
								}}
								onAddToSection={(sectionId) => {
									closeSectionEditor();
									const section = activeSections.find((entry) => entry.id === sectionId);
									if (!section) return;
									openCatalogAtSection({
										breakpoint: activeEditor.activeBreakpoint,
										x: section.x,
										y: section.y,
										label: titleCase(section.title),
										section_id: section.id
									});
								}}
							/>
						</div>
					</div>
				{/if}

				{#if editMode && activeEditor.catalogOpen}
					<div
						class="catalog-overlay"
						role="presentation"
						onpointerdown={closeCatalog}
					>
						<div
							class="catalog-sheet"
							role="dialog"
							aria-label="Card catalog"
							tabindex="-1"
							onpointerdown={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<DashboardCardCatalog
								editor={activeEditor}
								anchor={effectiveCatalogAnchor}
								onClearAnchor={() => {
									catalogAnchor = null;
								}}
							/>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style>
	.page {
		display: grid;
		gap: 0.85rem;
	}

	.heading {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 0.85rem;
	}

	.heading-actions {
		display: grid;
		gap: 0.55rem;
		justify-items: end;
	}

	.top-actions {
		display: flex;
		gap: 0.5rem;
	}

	h1 {
		margin: 0;
	}

	p {
		margin: 0.2rem 0 0;
		color: #68798c;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: end;
	}

	.badge,
	.tag,
	.live {
		padding: 0.3rem 0.65rem;
		border-radius: 0.45rem;
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
		font-size: 0.76rem;
	}

	.connected {
		background: var(--hc-success-soft);
		color: var(--hc-success);
	}

	.editor {
		background: var(--hc-warn-soft);
		color: var(--hc-warn);
	}

	.switcher {
		display: grid;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: #516477;
	}

	select {
		min-width: 220px;
		padding: 0.58rem 0.72rem;
	}

	.error { color: var(--hc-danger); }

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.85rem;
		align-items: start;
	}

	.workspace.editing {
		grid-template-columns: minmax(0, 1fr);
	}

	.canvas-column {
		position: relative;
	}

	.canvas-shell {
		display: grid;
		gap: 0.8rem;
		padding: 0.9rem;
		border-radius: 0.7rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
	}

	.canvas-header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 0.8rem;
	}

	.canvas-eyebrow {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: #7a8c9e;
	}

	.canvas-header h2 {
		margin: 0.08rem 0 0;
		font-size: 0.96rem;
	}

	.breakpoint-copy {
		margin-top: 0.28rem;
		font-size: 0.84rem;
		color: #6d8093;
		max-width: 32rem;
	}

	.canvas-actions {
		display: grid;
		gap: 0.4rem;
	}

	.composer-toolbar {
		display: grid;
		gap: 0.45rem;
		justify-items: end;
	}

	.composer-primary,
	.composer-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		justify-content: flex-end;
	}

	.composer-status {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		justify-content: flex-end;
	}

	.section-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		padding-top: 0.1rem;
	}

	.section-chip {
		display: flex;
		align-items: stretch;
		gap: 0.28rem;
		padding: 0.28rem;
		border-radius: 0.55rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
	}

	.section-chip.active {
		border-color: var(--hc-border-strong);
		background: var(--hc-surface-soft);
	}

	.section-focus,
	.section-add,
	.section-edit {
		font: inherit;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
	}

	.section-focus {
		display: grid;
		gap: 0.08rem;
		padding: 0.42rem 0.62rem;
		text-align: left;
		min-width: 10rem;
	}

	.section-focus strong {
		font-size: 0.76rem;
	}

	.section-focus span {
		font-size: 0.7rem;
		color: #6d7f92;
	}

	.section-add,
	.section-edit {
		padding: 0.42rem 0.62rem;
		font-size: 0.74rem;
		font-weight: 600;
	}

	.selection-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.42rem 0.68rem;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface-soft);
		font-size: 0.72rem;
		color: #5f7388;
		max-width: 20rem;
	}

	.breakpoint-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.breakpoint-pill {
		display: grid;
		gap: 0.1rem;
		padding: 0.42rem 0.6rem;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
		font: inherit;
		text-align: left;
		min-width: 4.7rem;
	}

	.breakpoint-pill strong {
		text-transform: capitalize;
		font-size: 0.76rem;
	}

	.breakpoint-pill span {
		font-size: 0.68rem;
		color: #718396;
	}

	.breakpoint-pill.active {
		background: var(--hc-accent-soft);
		border-color: color-mix(in srgb, var(--hc-accent) 25%, var(--hc-border));
	}

	.primary,
	.secondary {
		font: inherit;
		border-radius: 0.45rem;
		padding: 0.44rem 0.78rem;
		border: 1px solid var(--hc-border);
		font-size: 0.76rem;
	}

	.primary {
		background: var(--hc-accent);
		color: white;
		border-color: var(--hc-accent);
	}

	.secondary {
		background: var(--hc-surface);
		color: var(--hc-text);
	}

	.primary:disabled,
	.secondary:disabled {
		opacity: 0.55;
	}

	.status {
		padding: 0.22rem 0.5rem;
		border-radius: 0.4rem;
		font-size: 0.72rem;
	}

	.status.saved {
		background: var(--hc-success-soft);
		color: var(--hc-success);
	}

	.status.error {
		background: var(--hc-danger-soft);
		color: var(--hc-danger);
	}

	.inspector-overlay {
		position: fixed;
		inset: 0;
		background: rgba(26, 39, 52, 0.18);
		backdrop-filter: blur(3px);
		display: flex;
		justify-content: flex-end;
		padding: 1rem;
		z-index: 30;
	}

	.inspector-sheet {
		width: min(24rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
	}

	.catalog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(26, 39, 52, 0.12);
		backdrop-filter: blur(2px);
		display: flex;
		justify-content: flex-start;
		padding: 1rem;
		z-index: 29;
	}

	.catalog-sheet {
		width: min(24rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
	}

	@media (max-width: 860px) {
		.heading {
			flex-direction: column;
		}

		.heading-actions {
			width: 100%;
			justify-items: stretch;
		}

		.meta {
			justify-content: start;
		}

		select {
			width: 100%;
			min-width: 0;
		}
	}

	@media (max-width: 1180px) {
		.workspace {
			grid-template-columns: 1fr;
		}

		.canvas-header {
			flex-direction: column;
			align-items: start;
		}

		.canvas-actions,
		.composer-toolbar,
		.composer-primary,
		.composer-actions,
		.composer-status,
		.breakpoint-summary {
			justify-content: start;
			justify-items: start;
		}

		.inspector-overlay {
			padding: 0.7rem;
		}

		.catalog-overlay {
			padding: 0.7rem;
		}

		.inspector-sheet {
			width: min(100%, 22rem);
			max-height: calc(100vh - 1.4rem);
		}

		.catalog-sheet {
			width: min(100%, 22rem);
			max-height: calc(100vh - 1.4rem);
		}
	}
</style>
