import * as dashboardsApi from '$lib/api/dashboards';
import type {
	DashboardBreakpoint,
	DashboardDefinition,
	DashboardLayout,
	DashboardRefreshPolicy,
	DashboardSection,
	DashboardSectionLayoutPolicy,
	DashboardWidget,
	DashboardWidgetType,
	DashboardWidgetPlacement
} from '$lib/models/dashboard';
import { cloneDashboardDefinition } from '$lib/models/dashboard';
import { dashboardCardSpec, dashboardCardTemplate, dashboardCardTemplates } from '$lib/models/dashboardCards';
import {
	normalizeDashboardPlacement,
	resolveDashboardLayout,
	resolveDashboardSections
} from '$lib/models/dashboardLayout';

function cloneDashboard(dashboard: DashboardDefinition): DashboardDefinition {
	return cloneDashboardDefinition(dashboard);
}

function newWidgetId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSectionId(breakpoint: DashboardBreakpoint): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? `${breakpoint}-${crypto.randomUUID()}`
		: `${breakpoint}-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withStoredSections(dashboard: DashboardDefinition): DashboardDefinition {
	if (dashboard.sections.length > 0) return dashboard;

	const sections: DashboardSection[] = [];
	const layouts = dashboard.layouts.map((layout) => {
		const resolvedSections = resolveDashboardSections(layout, (placement) => {
			const widget = dashboard.widgets.find((entry) => entry.id === placement.widget_id);
			return widget ? dashboardCardSpec(widget.type).family : 'Section';
		});
		const sectionIdsByWidgetId = new Map<string, string>();
		for (const [index, section] of resolvedSections.entries()) {
			const sectionId = newSectionId(layout.breakpoint);
			sections.push({
				id: sectionId,
				breakpoint: layout.breakpoint,
				title: section.title,
				order: index,
				y: section.startRow,
				layout_policy: 'grid',
				min_h: Math.max(1, section.rowSpan),
				hidden: false
			});
			for (const placement of layout.placements) {
				if (placement.y >= section.startRow && placement.y < section.startRow + section.rowSpan) {
					sectionIdsByWidgetId.set(placement.widget_id, sectionId);
				}
			}
		}
		return {
			...layout,
			placements: layout.placements.map((placement) => ({
				...placement,
				section_id: sectionIdsByWidgetId.get(placement.widget_id) ?? placement.section_id ?? null
			}))
		};
	});

	return {
		...dashboard,
		sections,
		layouts
	};
}

function withNormalizedLayouts(dashboard: DashboardDefinition): DashboardDefinition {
	const withSections = withStoredSections(dashboard);
	return {
		...withSections,
		layouts: withSections.layouts.map((layout) =>
			resolveDashboardLayout(layout, { sections: withSections.sections })
		)
	};
}

function withNormalizedLayoutsAroundWidget(
	dashboard: DashboardDefinition,
	widgetId: string,
	breakpoint: DashboardBreakpoint
): DashboardDefinition {
	const withSections = withStoredSections(dashboard);
	return {
		...withSections,
		layouts: withSections.layouts.map((layout) =>
			layout.breakpoint === breakpoint
				? resolveDashboardLayout(layout, {
						activeWidgetId: widgetId,
						preserveActivePosition: true,
						sections: withSections.sections
					})
				: resolveDashboardLayout(layout, { sections: withSections.sections })
		)
	};
}

function pushSectionSiblingsDown(
	layout: DashboardLayout,
	widgetId: string,
	sectionId: string
): DashboardLayout {
	const anchor = layout.placements.find((placement) => placement.widget_id === widgetId);
	if (!anchor) return layout;

	const resolved: DashboardWidgetPlacement[] = [anchor];
	const siblings = layout.placements
		.filter((placement) => placement.section_id === sectionId && placement.widget_id !== widgetId)
		.sort((left, right) => {
			if (left.y !== right.y) return left.y - right.y;
			if (left.x !== right.x) return left.x - right.x;
			return left.widget_id.localeCompare(right.widget_id);
		});

	const remappedById = new Map<string, DashboardWidgetPlacement>([[anchor.widget_id, anchor]]);
	for (const sibling of siblings) {
		let next = { ...sibling };
		while (
			resolved.some(
				(existing) =>
					existing.widget_id !== next.widget_id &&
					existing.x < next.x + next.w &&
					existing.x + existing.w > next.x &&
					existing.y < next.y + next.h &&
					existing.y + existing.h > next.y
			)
		) {
			next = { ...next, y: next.y + 1 };
		}
		resolved.push(next);
		remappedById.set(next.widget_id, next);
	}

	return {
		...layout,
		placements: layout.placements.map((placement) => remappedById.get(placement.widget_id) ?? placement)
	};
}

function remapPlacementAcrossLayouts(
	placement: DashboardWidgetPlacement,
	sourceColumns: number,
	targetLayout: DashboardLayout
): DashboardWidgetPlacement {
	const columnRatio = targetLayout.columns / Math.max(1, sourceColumns);
	return normalizeDashboardPlacement(
		{
			...placement,
			x: Math.round(placement.x * columnRatio),
			w: Math.max(1, Math.round(placement.w * columnRatio)),
			section_id: null
		},
		targetLayout
	);
}

function placementForNewWidget(
	type: DashboardWidgetType,
	widgetId: string,
	layout: DashboardLayout,
	anchor?: Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'> & { section_id?: string | null }
): DashboardWidgetPlacement {
	const spec = dashboardCardSpec(type);
	if (!anchor) {
		const bottom = layout.placements.reduce(
			(max, placement) => Math.max(max, placement.y + placement.h),
			0
		);
		const width = Math.min(spec.preferredWidth, layout.columns);
		return {
			widget_id: widgetId,
			x: 0,
			y: bottom,
			w: Math.max(spec.minWidth, width),
			h: spec.minHeight,
			section_id: null
		};
	}

	return normalizeDashboardPlacement(
		{
			widget_id: widgetId,
			x: anchor.x,
			y: anchor.y,
			w: Math.max(spec.minWidth, Math.min(anchor.w, layout.columns)),
			h: Math.max(spec.minHeight, anchor.h),
			section_id: anchor.section_id ?? null
		},
		layout
	);
}

export class DashboardEditorState {
	baseline: DashboardDefinition;
	dashboard = $state<DashboardDefinition>() as DashboardDefinition;
	history = $state<DashboardDefinition[]>([]) as DashboardDefinition[];
	future = $state<DashboardDefinition[]>([]) as DashboardDefinition[];
	selectedWidgetId = $state<string | null>(null);
	activeBreakpoint = $state<DashboardBreakpoint>('desktop');
	search = $state('');
	catalogOpen = $state(true);
	inspectorOpen = $state(true);
	collapsedSectionIds = $state<string[]>([]) as string[];
	saving = $state(false);
	saveError = $state<string | null>(null);
	saveMessage = $state<string | null>(null);

	constructor(initialDashboard: DashboardDefinition) {
		const normalized = withNormalizedLayouts(cloneDashboard(initialDashboard));
		this.baseline = cloneDashboard(normalized);
		this.dashboard = cloneDashboard(normalized);
	}

	private applyDashboard(nextDashboard: DashboardDefinition, trackHistory = true) {
		const normalized = withNormalizedLayouts(nextDashboard);
		if (trackHistory) {
			this.history = [...this.history.slice(-39), cloneDashboard(this.dashboard)];
			this.future = [];
		}
		this.dashboard = normalized;
	}

	private applyDashboardAroundWidget(
		nextDashboard: DashboardDefinition,
		widgetId: string,
		breakpoint: DashboardBreakpoint,
		trackHistory = true
	) {
		const normalized = withNormalizedLayoutsAroundWidget(nextDashboard, widgetId, breakpoint);
		if (trackHistory) {
			this.history = [...this.history.slice(-39), cloneDashboard(this.dashboard)];
			this.future = [];
		}
		this.dashboard = normalized;
	}

	get widgets() {
		return this.dashboard.widgets;
	}

	get placements() {
		return this.dashboard.layouts.flatMap((layout) =>
			layout.placements.map((placement) => ({
				...placement,
				breakpoint: layout.breakpoint
			}))
		);
	}

	get filteredCatalog() {
		const query = this.search.trim().toLowerCase();
		return dashboardCardTemplates()
			.map((template) => ({
				template,
				spec: dashboardCardSpec(template.type),
				count: this.widgets.filter((widget) => widget.type === template.type).length
			}))
			.filter(({ template, spec }) => {
				if (!query) return true;
				return [template.title, template.subtitle, template.type, spec.family]
					.filter(Boolean)
					.join(' ')
					.toLowerCase()
					.includes(query);
			});
	}

	get selectedWidget(): DashboardWidget | null {
		if (!this.selectedWidgetId) return null;
		return this.widgets.find((widget) => widget.id === this.selectedWidgetId) ?? this.widgets[0] ?? null;
	}

	get selectedPlacement(): (DashboardWidgetPlacement & { breakpoint: string }) | null {
		const widget = this.selectedWidget;
		if (!widget) return null;
		return (
			this.placements.find(
				(placement) =>
					placement.widget_id === widget.id && placement.breakpoint === this.activeBreakpoint
			) ??
			this.placements.find((placement) => placement.widget_id === widget.id) ??
			null
		);
	}

	get selectedPlacements(): Array<DashboardWidgetPlacement & { breakpoint: DashboardBreakpoint; columns: number }> {
		const widget = this.selectedWidget;
		if (!widget) return [];
		return this.dashboard.layouts
			.map((layout) => {
				const placement = layout.placements.find((entry) => entry.widget_id === widget.id);
				if (!placement) return null;
				return {
					...placement,
					breakpoint: layout.breakpoint,
					columns: layout.columns
				};
			})
			.filter((value): value is DashboardWidgetPlacement & { breakpoint: DashboardBreakpoint; columns: number } => value !== null);
	}

	get activeLayout(): DashboardLayout | null {
		return this.dashboard.layouts.find((layout) => layout.breakpoint === this.activeBreakpoint) ?? null;
	}

	get activeSections(): DashboardSection[] {
		return this.dashboard.sections
			.filter((section) => section.breakpoint === this.activeBreakpoint)
			.sort((left, right) => {
				if (left.order !== right.order) return left.order - right.order;
				return left.id.localeCompare(right.id);
			});
	}

	get selectedSection(): DashboardSection | null {
		const placement = this.selectedPlacement;
		if (!placement?.section_id) return null;
		return this.dashboard.sections.find((section) => section.id === placement.section_id) ?? null;
	}

	get selectedWidgetIndex() {
		if (!this.selectedWidgetId) return -1;
		return this.widgets.findIndex((widget) => widget.id === this.selectedWidgetId);
	}

	get canUndo() {
		return this.history.length > 0;
	}

	get canRedo() {
		return this.future.length > 0;
	}

	setActiveBreakpoint(breakpoint: DashboardBreakpoint) {
		this.activeBreakpoint = breakpoint;
	}

	undo() {
		const previous = this.history.at(-1);
		if (!previous) return;
		this.future = [cloneDashboard(this.dashboard), ...this.future];
		this.history = this.history.slice(0, -1);
		this.dashboard = withNormalizedLayouts(cloneDashboard(previous));
		this.saveError = null;
		this.saveMessage = null;
	}

	redo() {
		const next = this.future[0];
		if (!next) return;
		this.history = [...this.history, cloneDashboard(this.dashboard)];
		this.future = this.future.slice(1);
		this.dashboard = withNormalizedLayouts(cloneDashboard(next));
		this.saveError = null;
		this.saveMessage = null;
	}

	copySelectedPlacement(sourceBreakpoint: DashboardBreakpoint, targetBreakpoint: DashboardBreakpoint) {
		const widget = this.selectedWidget;
		if (!widget || sourceBreakpoint === targetBreakpoint) return;
		const sourceLayout = this.dashboard.layouts.find((layout) => layout.breakpoint === sourceBreakpoint);
		const targetLayout = this.dashboard.layouts.find((layout) => layout.breakpoint === targetBreakpoint);
		const sourcePlacement = sourceLayout?.placements.find((entry) => entry.widget_id === widget.id);
		if (!sourceLayout || !targetLayout || !sourcePlacement) return;

		const remapped = remapPlacementAcrossLayouts(sourcePlacement, sourceLayout.columns, targetLayout);
		this.applyDashboard({
			...this.dashboard,
			layouts: this.dashboard.layouts.map((layout) => {
				if (layout.breakpoint !== targetBreakpoint) return layout;
				return {
					...layout,
					placements: layout.placements.map((placement) =>
						placement.widget_id === widget.id ? remapped : placement
					)
				};
			})
		});
		this.activeBreakpoint = targetBreakpoint;
		this.saveError = null;
		this.saveMessage = null;
	}

	copySelectedPlacementToAllBreakpoints(sourceBreakpoint: DashboardBreakpoint) {
		const widget = this.selectedWidget;
		if (!widget) return;
		const sourceLayout = this.dashboard.layouts.find((layout) => layout.breakpoint === sourceBreakpoint);
		const sourcePlacement = sourceLayout?.placements.find((entry) => entry.widget_id === widget.id);
		if (!sourceLayout || !sourcePlacement) return;

		this.applyDashboard({
			...this.dashboard,
			layouts: this.dashboard.layouts.map((layout) => {
				if (layout.breakpoint === sourceBreakpoint) return layout;
				const remapped = remapPlacementAcrossLayouts(sourcePlacement, sourceLayout.columns, layout);
				return {
					...layout,
					placements: layout.placements.map((placement) =>
						placement.widget_id === widget.id ? remapped : placement
					)
				};
			})
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	select(widgetId: string) {
		this.selectedWidgetId = widgetId;
		this.saveMessage = null;
	}

	clearSelection() {
		this.selectedWidgetId = null;
		this.saveMessage = null;
	}

	selectFirstWidget() {
		const widget = this.widgets[0];
		if (!widget) return;
		this.select(widget.id);
	}

	selectLastWidget() {
		const widget = this.widgets.at(-1);
		if (!widget) return;
		this.select(widget.id);
	}

	selectNextWidget() {
		if (this.widgets.length === 0) return;
		const currentIndex = this.selectedWidgetIndex;
		if (currentIndex < 0) {
			this.selectFirstWidget();
			return;
		}
		this.select(this.widgets[(currentIndex + 1) % this.widgets.length].id);
	}

	selectPreviousWidget() {
		if (this.widgets.length === 0) return;
		const currentIndex = this.selectedWidgetIndex;
		if (currentIndex < 0) {
			this.selectLastWidget();
			return;
		}
		this.select(this.widgets[(currentIndex + this.widgets.length - 1) % this.widgets.length].id);
	}

	addWidget(type: DashboardWidgetType) {
		this.addWidgetAtBreakpoint(type, this.activeBreakpoint);
	}

	addWidgetAtBreakpoint(
		type: DashboardWidgetType,
		sourceBreakpoint: DashboardBreakpoint,
		anchor?: Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'> & { section_id?: string | null }
	) {
		const template = dashboardCardTemplate(type);
		const widgetId = newWidgetId();
		const widget: DashboardWidget = {
			id: widgetId,
			type,
			title: template.title,
			subtitle: template.subtitle,
			refresh_policy: template.refresh_policy,
			config: template.config
		};
		const sourceLayout = this.dashboard.layouts.find((layout) => layout.breakpoint === sourceBreakpoint);
		const sourcePlacement = sourceLayout
			? placementForNewWidget(type, widgetId, sourceLayout, anchor)
			: null;
		this.applyDashboard({
			...this.dashboard,
			widgets: [...this.dashboard.widgets, widget],
			layouts: this.dashboard.layouts.map((layout) => {
				const placement =
					layout.breakpoint === sourceBreakpoint || !sourceLayout || !sourcePlacement
						? placementForNewWidget(type, widgetId, layout, anchor)
						: remapPlacementAcrossLayouts(sourcePlacement, sourceLayout.columns, layout);
				return {
					...layout,
					placements: [...layout.placements, placement]
				};
			})
		});
		this.select(widgetId);
		this.openInspector();
		this.catalogOpen = false;
		this.saveError = null;
		this.saveMessage = null;
	}

	createSection(
		breakpoint: DashboardBreakpoint,
		title = 'New Section',
		options?: { order?: number; y?: number }
	): string {
		const layout = this.dashboard.layouts.find((entry) => entry.breakpoint === breakpoint);
		const existingSections = this.dashboard.sections
			.filter((section) => section.breakpoint === breakpoint)
			.sort((left, right) => {
				if (left.order !== right.order) return left.order - right.order;
				return left.id.localeCompare(right.id);
			});
		const nextOrder =
			options?.order !== undefined
				? Math.max(0, Math.min(existingSections.length, options.order))
				: existingSections.length;
		const nextY =
			options?.y ??
			(layout
				? layout.placements.reduce((max, placement) => Math.max(max, placement.y + placement.h + 1), 0)
				: 0);
		const sectionId = newSectionId(breakpoint);
		this.applyDashboard({
			...this.dashboard,
			sections: [
				...this.dashboard.sections.map((section) =>
					section.breakpoint === breakpoint && section.order >= nextOrder
						? { ...section, order: section.order + 1 }
						: section
				),
				{
					id: sectionId,
					breakpoint,
					title,
					order: nextOrder,
					y: nextY,
					layout_policy: 'grid',
					min_h: 1,
					hidden: false
				}
			]
		});
		this.activeBreakpoint = breakpoint;
		this.saveError = null;
		this.saveMessage = null;
		return sectionId;
	}

	renameSection(sectionId: string, title: string) {
		const nextTitle = title.trim();
		if (!nextTitle) return;
		this.applyDashboard({
			...this.dashboard,
			sections: this.dashboard.sections.map((section) =>
				section.id === sectionId ? { ...section, title: nextTitle } : section
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	updateSectionY(sectionId: string, value: number) {
		const nextY = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
		this.applyDashboard({
			...this.dashboard,
			sections: this.dashboard.sections.map((section) =>
				section.id === sectionId ? { ...section, y: nextY } : section
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	nudgeSectionY(sectionId: string, delta: number) {
		if (!delta) return;
		const section = this.dashboard.sections.find((entry) => entry.id === sectionId);
		if (!section) return;
		this.updateSectionY(sectionId, section.y + delta);
	}

	updateSectionLayoutPolicy(sectionId: string, layoutPolicy: DashboardSectionLayoutPolicy) {
		this.applyDashboard({
			...this.dashboard,
			sections: this.dashboard.sections.map((section) =>
				section.id === sectionId ? { ...section, layout_policy: layoutPolicy } : section
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	updateSectionMinH(sectionId: string, value: number) {
		const nextMinH = Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
		this.applyDashboard({
			...this.dashboard,
			sections: this.dashboard.sections.map((section) =>
				section.id === sectionId ? { ...section, min_h: nextMinH } : section
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	updateSectionHidden(sectionId: string, hidden: boolean) {
		this.applyDashboard({
			...this.dashboard,
			sections: this.dashboard.sections.map((section) =>
				section.id === sectionId ? { ...section, hidden } : section
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	moveSection(sectionId: string, delta: number) {
		if (!delta) return;
		const section = this.dashboard.sections.find((entry) => entry.id === sectionId);
		if (!section) return;
		const sections = this.dashboard.sections
			.filter((entry) => entry.breakpoint === section.breakpoint)
			.sort((left, right) => {
				if (left.order !== right.order) return left.order - right.order;
				return left.id.localeCompare(right.id);
			});
		const currentIndex = sections.findIndex((entry) => entry.id === sectionId);
		if (currentIndex < 0) return;
		const targetIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + delta));
		if (targetIndex === currentIndex) return;
		const reordered = [...sections];
		const [moved] = reordered.splice(currentIndex, 1);
		reordered.splice(targetIndex, 0, moved);
		const reorderedById = new Map(reordered.map((entry, index) => [entry.id, index]));
		this.applyDashboard({
			...this.dashboard,
			sections: this.dashboard.sections.map((entry) =>
				entry.breakpoint === section.breakpoint
					? { ...entry, order: reorderedById.get(entry.id) ?? entry.order }
					: entry
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	moveSectionToIndex(sectionId: string, targetIndex: number) {
		const section = this.dashboard.sections.find((entry) => entry.id === sectionId);
		if (!section) return;
		const sections = this.dashboard.sections
			.filter((entry) => entry.breakpoint === section.breakpoint)
			.sort((left, right) => {
				if (left.order !== right.order) return left.order - right.order;
				return left.id.localeCompare(right.id);
			});
		const currentIndex = sections.findIndex((entry) => entry.id === sectionId);
		if (currentIndex < 0) return;
		const nextIndex = Math.max(0, Math.min(sections.length - 1, targetIndex));
		if (nextIndex === currentIndex) return;
		const reordered = [...sections];
		const [moved] = reordered.splice(currentIndex, 1);
		reordered.splice(nextIndex, 0, moved);
		const reorderedById = new Map(reordered.map((entry, index) => [entry.id, index]));
		this.applyDashboard({
			...this.dashboard,
			sections: this.dashboard.sections.map((entry) =>
				entry.breakpoint === section.breakpoint
					? { ...entry, order: reorderedById.get(entry.id) ?? entry.order }
					: entry
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	toggleSectionCollapsed(sectionId: string) {
		this.collapsedSectionIds = this.collapsedSectionIds.includes(sectionId)
			? this.collapsedSectionIds.filter((entry) => entry !== sectionId)
			: [...this.collapsedSectionIds, sectionId];
	}

	isSectionCollapsed(sectionId: string): boolean {
		return this.collapsedSectionIds.includes(sectionId);
	}

	expandSection(sectionId: string) {
		if (!this.collapsedSectionIds.includes(sectionId)) return;
		this.collapsedSectionIds = this.collapsedSectionIds.filter((entry) => entry !== sectionId);
	}

	deleteSection(sectionId: string) {
		const section = this.dashboard.sections.find((entry) => entry.id === sectionId);
		if (!section) return;
		const remainingSameBreakpoint = this.dashboard.sections
			.filter((entry) => entry.id !== sectionId && entry.breakpoint === section.breakpoint)
			.sort((left, right) => left.order - right.order)
			.map((entry, index) => ({ ...entry, order: index }));
		this.applyDashboard({
			...this.dashboard,
			sections: [
				...this.dashboard.sections.filter(
					(entry) => entry.id !== sectionId && entry.breakpoint !== section.breakpoint
				),
				...remainingSameBreakpoint
			],
			layouts: this.dashboard.layouts.map((layout) => ({
				...layout,
				placements: layout.placements.map((placement) =>
					placement.section_id === sectionId ? { ...placement, section_id: null } : placement
				)
			}))
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	assignSelectedWidgetToSection(sectionId: string | null) {
		const widget = this.selectedWidget;
		if (!widget) return;
		this.moveWidgetToSection(widget.id, sectionId, this.activeBreakpoint);
	}

	moveWidgetToSection(
		widgetId: string,
		sectionId: string | null,
		breakpoint: DashboardBreakpoint = this.activeBreakpoint,
		targetPlacement?: Partial<Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'>>
	) {
		const layout = this.dashboard.layouts.find((entry) => entry.breakpoint === breakpoint);
		if (!layout) return;
		const targetSection = sectionId
			? this.dashboard.sections.find(
					(entry) => entry.id === sectionId && entry.breakpoint === breakpoint
				) ?? null
			: null;
		this.applyDashboardAroundWidget(
			{
				...this.dashboard,
				layouts: this.dashboard.layouts.map((entry) => {
					if (entry.breakpoint !== breakpoint) return entry;
					const reassigned: DashboardLayout = {
						...entry,
						placements: entry.placements.map((placement) => {
							if (placement.widget_id !== widgetId) return placement;
							return normalizeDashboardPlacement(
								{
									...placement,
									x: targetPlacement?.x ?? placement.x,
									y: targetPlacement?.y ?? (targetSection ? targetSection.y : placement.y),
									w: targetPlacement?.w ?? placement.w,
									h: targetPlacement?.h ?? placement.h,
									section_id: targetSection?.id ?? null
								},
								layout
							);
						})
					};
					return targetSection?.layout_policy === 'grid'
						? pushSectionSiblingsDown(reassigned, widgetId, targetSection.id)
						: reassigned;
				})
			},
			widgetId,
			breakpoint
		);
		this.saveError = null;
		this.saveMessage = null;
	}

	moveSelectedWidgetToAdjacentSection(delta: number) {
		const widget = this.selectedWidget;
		const layout = this.activeLayout;
		if (!widget || !layout || !delta) return;
		const placement = layout.placements.find((entry) => entry.widget_id === widget.id);
		if (!placement) return;
		const sections = this.activeSections;
		if (sections.length === 0) return;
		const currentIndex = placement.section_id
			? sections.findIndex((section) => section.id === placement.section_id)
			: -1;
		const nextIndex = currentIndex < 0
			? delta > 0
				? 0
				: sections.length - 1
			: Math.max(0, Math.min(sections.length - 1, currentIndex + delta));
		if (nextIndex === currentIndex && currentIndex >= 0) return;
		this.moveWidgetToSection(widget.id, sections[nextIndex]?.id ?? null, this.activeBreakpoint);
	}

	duplicateSelectedWidget() {
		const widget = this.selectedWidget;
		if (!widget) return;
		const widgetId = newWidgetId();
		const copy: DashboardWidget = {
			...cloneDashboard({ widgets: [widget] } as DashboardDefinition).widgets[0],
			id: widgetId,
			title: `${widget.title} Copy`
		};
		this.applyDashboard({
			...this.dashboard,
			widgets: [...this.dashboard.widgets, copy],
			layouts: this.dashboard.layouts.map((layout) => {
				const placement = layout.placements.find((entry) => entry.widget_id === widget.id);
				if (!placement) return layout;
				const width = Math.min(placement.w, Math.max(1, layout.columns));
				const shiftedX = Math.min(layout.columns - width, placement.x + 1);
				const nextPlacement: DashboardWidgetPlacement = {
					...placement,
					widget_id: widgetId,
					x: Math.max(0, shiftedX),
					y: placement.y + 1
				};
				return {
					...layout,
					placements: [...layout.placements, nextPlacement]
				};
			})
		});
		this.select(widgetId);
		this.openInspector();
		this.saveError = null;
		this.saveMessage = null;
	}

	deleteSelectedWidget() {
		const widget = this.selectedWidget;
		if (!widget) return;
		const remainingWidgets = this.dashboard.widgets.filter((entry) => entry.id !== widget.id);
		this.applyDashboard({
			...this.dashboard,
			widgets: remainingWidgets,
			layouts: this.dashboard.layouts.map((layout) => ({
				...layout,
				placements: layout.placements.filter((placement) => placement.widget_id !== widget.id)
			}))
		});
		this.selectedWidgetId = remainingWidgets[0]?.id ?? null;
		this.saveError = null;
		this.saveMessage = null;
	}

	setSearch(value: string) {
		this.search = value;
		if (!this.catalogOpen) {
			this.catalogOpen = true;
		}
	}

	openCatalog() {
		this.catalogOpen = true;
	}

	closeCatalog() {
		this.catalogOpen = false;
	}

	toggleCatalog() {
		this.catalogOpen = !this.catalogOpen;
	}

	openInspector() {
		this.inspectorOpen = true;
	}

	closeInspector() {
		this.inspectorOpen = false;
	}

	toggleInspector() {
		this.inspectorOpen = !this.inspectorOpen;
	}

	updateSelectedWidgetField(field: 'title' | 'subtitle', value: string) {
		const widget = this.selectedWidget;
		if (!widget) return;
		const next = field === 'subtitle' && value.trim() === '' ? null : value;
		this.applyDashboard({
			...this.dashboard,
			widgets: this.dashboard.widgets.map((entry) =>
				entry.id === widget.id ? { ...entry, [field]: next } : entry
			)
		});
		this.saveMessage = null;
	}

	updateSelectedRefreshPolicy(value: DashboardRefreshPolicy) {
		const widget = this.selectedWidget;
		if (!widget) return;
		this.applyDashboard({
			...this.dashboard,
			widgets: this.dashboard.widgets.map((entry) =>
				entry.id === widget.id ? { ...entry, refresh_policy: value } : entry
			)
		});
		this.saveMessage = null;
	}

	updateSelectedConfigFromJson(value: string) {
		const widget = this.selectedWidget;
		if (!widget) return;
		this.saveError = null;
		try {
			const parsed = JSON.parse(value) as Record<string, unknown>;
			this.applyDashboard({
				...this.dashboard,
				widgets: this.dashboard.widgets.map((entry) =>
					entry.id === widget.id ? { ...entry, config: parsed } : entry
				)
			});
			this.saveMessage = null;
		} catch (error) {
			this.saveError = error instanceof Error ? error.message : 'Invalid JSON config';
		}
	}

	updateSelectedConfigField(key: string, value: unknown) {
		const widget = this.selectedWidget;
		if (!widget) return;
		const nextConfig = { ...(widget.config ?? {}) } as Record<string, unknown>;
		const shouldDelete =
			value === null ||
			value === undefined ||
			(typeof value === 'string' && value.trim() === '') ||
			(Array.isArray(value) && value.length === 0);
		if (shouldDelete) {
			delete nextConfig[key];
		} else {
			nextConfig[key] = value;
		}
		this.applyDashboard({
			...this.dashboard,
			widgets: this.dashboard.widgets.map((entry) =>
				entry.id === widget.id ? { ...entry, config: nextConfig } : entry
			)
		});
		this.saveError = null;
		this.saveMessage = null;
	}

	updateSelectedStringListField(key: string, value: string) {
		const items = value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
		this.updateSelectedConfigField(key, items);
	}

	updateSelectedPlacementField(
		breakpoint: DashboardBreakpoint,
		field: keyof DashboardWidgetPlacement,
		value: number
	) {
		const widget = this.selectedWidget;
		if (!widget) return;
		const nextValue = Number.isFinite(value) ? Math.floor(value) : 0;
		this.applyDashboardAroundWidget({
			...this.dashboard,
			layouts: this.dashboard.layouts.map((layout) => {
				if (layout.breakpoint !== breakpoint) return layout;
				return {
					...layout,
					placements: layout.placements.map((placement) => {
						if (placement.widget_id !== widget.id) return placement;
						return normalizeDashboardPlacement({ ...placement, [field]: nextValue }, layout);
					})
				};
			})
		}, widget.id, breakpoint);
		this.saveError = null;
		this.saveMessage = null;
	}

	setPlacement(
		widgetId: string,
		breakpoint: DashboardBreakpoint,
		nextPlacement: Pick<DashboardWidgetPlacement, 'x' | 'y' | 'w' | 'h'>
	) {
		if (this.selectedWidgetId !== widgetId) {
			this.select(widgetId);
		}
		this.applyDashboardAroundWidget({
			...this.dashboard,
			layouts: this.dashboard.layouts.map((layout) => {
				if (layout.breakpoint !== breakpoint) return layout;
				return {
					...layout,
					placements: layout.placements.map((placement) => {
						if (placement.widget_id !== widgetId) return placement;
						return normalizeDashboardPlacement({ ...placement, ...nextPlacement }, layout);
					})
				};
			})
		}, widgetId, breakpoint);
		this.saveError = null;
		this.saveMessage = null;
	}

	applySelectedLayoutPreset(
		preset: 'compact' | 'half' | 'full' | 'tall' | 'hero',
		breakpoint: DashboardBreakpoint = this.activeBreakpoint
	) {
		const widget = this.selectedWidget;
		const layout = this.dashboard.layouts.find((entry) => entry.breakpoint === breakpoint);
		if (!widget || !layout) return;
		const placement = layout.placements.find((entry) => entry.widget_id === widget.id);
		if (!placement) return;
		const section = placement.section_id
			? this.dashboard.sections.find(
					(entry) => entry.id === placement.section_id && entry.breakpoint === breakpoint
				) ?? null
			: null;
		const spec = dashboardCardSpec(widget.type);
		const compactWidth = Math.max(
			spec.minWidth,
			Math.min(spec.preferredWidth, Math.max(1, Math.ceil(layout.columns / 3)))
		);
		const halfWidth = Math.max(
			spec.minWidth,
			Math.min(layout.columns, Math.max(1, Math.ceil(layout.columns / 2)))
		);
		const nextPlacement =
			preset === 'compact'
				? { x: 0, y: placement.y, w: compactWidth, h: Math.max(spec.minHeight, 1) }
				: preset === 'half'
					? { x: 0, y: placement.y, w: halfWidth, h: Math.max(spec.minHeight, placement.h) }
					: preset === 'full'
						? { x: 0, y: placement.y, w: layout.columns, h: Math.max(spec.minHeight, placement.h) }
						: preset === 'tall'
							? { x: placement.x, y: placement.y, w: placement.w, h: Math.max(spec.minHeight + 1, placement.h + 1) }
							: {
									x: 0,
									y: placement.y,
									w: layout.columns,
									h: Math.max(spec.minHeight + 1, Math.max(placement.h + 1, 3))
								};

		if (section?.layout_policy === 'stack') {
			this.updateSelectedPlacementField(breakpoint, 'h', nextPlacement.h);
			return;
		}

		this.setPlacement(widget.id, breakpoint, nextPlacement);
	}

	nudgePlacement(
		widgetId: string,
		breakpoint: DashboardBreakpoint,
		field: 'x' | 'y' | 'w' | 'h',
		delta: number
	) {
		const widget = this.dashboard.widgets.find((entry) => entry.id === widgetId);
		if (!widget) return;
		if (this.selectedWidgetId !== widgetId) {
			this.select(widgetId);
		}
		const currentPlacement = this.dashboard.layouts
			.find((layout) => layout.breakpoint === breakpoint)
			?.placements.find((placement) => placement.widget_id === widgetId);
		if (!currentPlacement) return;
		this.updateSelectedPlacementField(breakpoint, field, currentPlacement[field] + delta);
	}

	get supportsTypedConfig(): boolean {
		const widget = this.selectedWidget;
		if (!widget) return false;
		return ['device_grid', 'device_list', 'event_feed', 'markdown'].includes(widget.type);
	}

	get typedConfigKind(): DashboardWidgetType | null {
		return this.selectedWidget?.type ?? null;
	}

	reset() {
		this.applyDashboard(cloneDashboard(this.baseline));
		this.collapsedSectionIds = [];
		this.saveError = null;
		this.saveMessage = null;
	}

	get dirty() {
		return JSON.stringify(this.dashboard) !== JSON.stringify(this.baseline);
	}

	async save(): Promise<DashboardDefinition> {
		this.saving = true;
		this.saveError = null;
		this.saveMessage = null;
		try {
			const updated = await dashboardsApi.updateDashboard(
				this.dashboard.id,
				withNormalizedLayouts(this.dashboard)
			);
			this.baseline = cloneDashboard(updated);
			this.dashboard = withNormalizedLayouts(cloneDashboard(updated));
			this.history = [];
			this.future = [];
			this.collapsedSectionIds = [];
			this.saveMessage = 'Saved';
			return updated;
		} catch (error) {
			this.saveError = error instanceof Error ? error.message : 'Unable to save dashboard';
			throw error;
		} finally {
			this.saving = false;
		}
	}
}

export function createDashboardEditorState(dashboard: DashboardDefinition) {
	return new DashboardEditorState(dashboard);
}
