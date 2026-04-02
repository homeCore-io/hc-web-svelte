import type {
	DashboardLayout,
	DashboardSection,
	DashboardWidgetPlacement
} from '$lib/models/dashboard';

type ResolveLayoutOptions = {
	activeWidgetId?: string;
	preserveActivePosition?: boolean;
	sections?: DashboardSection[];
};

export type DashboardLayoutSection = {
	id: string;
	startRow: number;
	rowSpan: number;
	cardCount: number;
	title: string;
	x: number;
	y: number;
	firstWidgetId: string;
};

export function dashboardPlacementsOverlap(
	a: DashboardWidgetPlacement,
	b: DashboardWidgetPlacement
): boolean {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function normalizeDashboardPlacement(
	placement: DashboardWidgetPlacement,
	layout: DashboardLayout
): DashboardWidgetPlacement {
	const next = { ...placement };
	next.x = Math.max(0, Math.min(Math.floor(next.x), Math.max(0, layout.columns - 1)));
	next.y = Math.max(0, Math.floor(next.y));
	next.w = Math.max(1, Math.min(Math.floor(next.w), Math.max(1, layout.columns - next.x)));
	next.h = Math.max(1, Math.floor(next.h));
	return next;
}

function findPlacementSlot(
	placement: DashboardWidgetPlacement,
	layout: DashboardLayout,
	resolved: DashboardWidgetPlacement[]
): DashboardWidgetPlacement {
	const maxX = Math.max(0, layout.columns - placement.w);

	for (let y = placement.y; y <= placement.y + resolved.length + 24; y += 1) {
		const xOrder =
			y === placement.y
				? [placement.x, ...Array.from({ length: maxX + 1 }, (_, index) => index).filter((x) => x !== placement.x)]
				: Array.from({ length: maxX + 1 }, (_, index) => index);

		for (const x of xOrder) {
			const candidate = { ...placement, x, y };
			if (!resolved.some((existing) => dashboardPlacementsOverlap(existing, candidate))) {
				return candidate;
			}
		}
	}

	return placement;
}

function liftPlacement(
	placement: DashboardWidgetPlacement,
	layout: DashboardLayout,
	resolved: DashboardWidgetPlacement[]
): DashboardWidgetPlacement {
	const maxX = Math.max(0, layout.columns - placement.w);
	let best = { ...placement };

	for (let y = 0; y < placement.y; y += 1) {
		for (let x = 0; x <= maxX; x += 1) {
			const candidate = { ...placement, x, y };
			const blocked = resolved.some(
				(existing) =>
					existing.widget_id !== placement.widget_id &&
					dashboardPlacementsOverlap(existing, candidate)
			);
			if (!blocked) {
				best = candidate;
				return best;
			}
		}
	}

	return best;
}

export function resolveDashboardLayout(
	layout: DashboardLayout,
	options: ResolveLayoutOptions = {}
): DashboardLayout {
	const policyAdjusted = applySectionLayoutPolicies(layout, options.sections ?? []);
	const normalized = policyAdjusted.placements.map((placement) =>
		normalizeDashboardPlacement(placement, policyAdjusted)
	);
	const sorted = normalized.sort((left, right) => {
		if (options.activeWidgetId) {
			if (left.widget_id === options.activeWidgetId) return -1;
			if (right.widget_id === options.activeWidgetId) return 1;
		}
		if (left.y !== right.y) return left.y - right.y;
		if (left.x !== right.x) return left.x - right.x;
		return left.widget_id.localeCompare(right.widget_id);
	});

	const resolved: DashboardWidgetPlacement[] = [];
	for (const placement of sorted) {
		const keepActivePosition =
			options.preserveActivePosition && placement.widget_id === options.activeWidgetId;
		const next = keepActivePosition
			? placement
			: findPlacementSlot(placement, policyAdjusted, resolved);
		const fallback = keepActivePosition
			? findPlacementSlot(placement, policyAdjusted, resolved)
			: next;
		resolved.push(
			resolved.some((existing) => dashboardPlacementsOverlap(existing, next)) ? fallback : next
		);
	}

	const compacted = resolved
		.map((placement) =>
			options.preserveActivePosition && placement.widget_id === options.activeWidgetId
				? placement
				: liftPlacement(placement, policyAdjusted, resolved)
		)
		.sort((left, right) => {
			if (left.y !== right.y) return left.y - right.y;
			if (left.x !== right.x) return left.x - right.x;
			return left.widget_id.localeCompare(right.widget_id);
		});

	return {
		...policyAdjusted,
		placements: compacted
	};
}

function applySectionLayoutPolicies(
	layout: DashboardLayout,
	sections: DashboardSection[]
): DashboardLayout {
	const matchingSections = sections
		.filter((section) => section.breakpoint === layout.breakpoint)
		.sort((left, right) => {
			if (left.order !== right.order) return left.order - right.order;
			return left.id.localeCompare(right.id);
		});
	if (matchingSections.length === 0) return layout;

	const placementsBySectionId = new Map<string, DashboardWidgetPlacement[]>();
	for (const placement of layout.placements) {
		if (!placement.section_id) continue;
		const sectionPlacements = placementsBySectionId.get(placement.section_id) ?? [];
		sectionPlacements.push(placement);
		placementsBySectionId.set(placement.section_id, sectionPlacements);
	}

	const remapped = layout.placements.map((placement) => ({ ...placement }));
	for (const section of matchingSections) {
		if (section.layout_policy !== 'stack' && section.layout_policy !== 'row') continue;
		const sectionPlacements = (placementsBySectionId.get(section.id) ?? []).sort((left, right) => {
			if (left.y !== right.y) return left.y - right.y;
			if (left.x !== right.x) return left.x - right.x;
			return left.widget_id.localeCompare(right.widget_id);
		});
		let cursorY = Math.max(0, section.y);
		let cursorX = 0;
		for (const sectionPlacement of sectionPlacements) {
			const index = remapped.findIndex((entry) => entry.widget_id === sectionPlacement.widget_id);
			if (index < 0) continue;
			if (section.layout_policy === 'row') {
				const width = Math.min(layout.columns, Math.max(1, remapped[index].w));
				if (cursorX + width > layout.columns) {
					cursorX = 0;
					cursorY += Math.max(1, remapped[index].h);
				}
				remapped[index] = {
					...remapped[index],
					x: cursorX,
					y: cursorY,
					w: width
				};
				cursorX += width;
				continue;
			}
			remapped[index] = {
				...remapped[index],
				x: 0,
				y: cursorY,
				w: layout.columns
			};
			cursorY += Math.max(1, remapped[index].h);
		}
	}

	return {
		...layout,
		placements: remapped
	};
}

export function resolveDashboardSections(
	layout: DashboardLayout,
	resolveTitle: (placement: DashboardWidgetPlacement) => string,
	explicitSections: DashboardSection[] = []
): DashboardLayoutSection[] {
	const matchingSections = explicitSections
		.filter((section) => section.breakpoint === layout.breakpoint)
		.sort((left, right) => {
			if (left.order !== right.order) return left.order - right.order;
			return left.id.localeCompare(right.id);
		});

	if (matchingSections.length > 0) {
		const sections = matchingSections.map((section) => {
			const placements = layout.placements
				.filter((placement) => placement.section_id === section.id)
				.sort((left, right) => {
					if (left.y !== right.y) return left.y - right.y;
					if (left.x !== right.x) return left.x - right.x;
					return left.widget_id.localeCompare(right.widget_id);
				});
			const startRow =
				placements.length > 0
					? Math.min(section.y, ...placements.map((placement) => placement.y))
					: section.y;
			const endRow =
				placements.length > 0
					? Math.max(section.y + section.min_h, ...placements.map((placement) => placement.y + placement.h))
					: section.y + section.min_h;
			return {
				id: section.id,
				startRow,
				rowSpan: Math.max(1, endRow - startRow),
				cardCount: placements.length,
				title: section.title,
				x: 0,
				y: Math.max(section.y, endRow),
				firstWidgetId: placements[0]?.widget_id ?? ''
			};
		});

		const unassignedPlacements = layout.placements.filter((placement) => !placement.section_id);
		if (unassignedPlacements.length === 0) {
			return sections;
		}

		const inferred = resolveDashboardSections(
			{ ...layout, placements: unassignedPlacements },
			resolveTitle,
			[]
		);
		return [
			...sections,
			...inferred.map((section, index) => ({
				...section,
				id: `unassigned-${layout.breakpoint}-${index}`,
				title: index === 0 ? 'Unassigned' : `Unassigned ${index + 1}`
			}))
		];
	}

	const placements = [...layout.placements].sort((left, right) => {
		if (left.y !== right.y) return left.y - right.y;
		if (left.x !== right.x) return left.x - right.x;
		return left.widget_id.localeCompare(right.widget_id);
	});

	const sections: DashboardLayoutSection[] = [];
	for (const placement of placements) {
		const title = resolveTitle(placement);
		const startRow = placement.y;
		const endRow = placement.y + placement.h;
		const current = sections.at(-1);

		if (!current || startRow > current.startRow + current.rowSpan + 1) {
			sections.push({
				id: `${placement.widget_id}-section`,
				startRow,
				rowSpan: Math.max(1, endRow - startRow),
				cardCount: 1,
				title,
				x: 0,
				y: endRow + 1,
				firstWidgetId: placement.widget_id
			});
			continue;
		}

		current.rowSpan = Math.max(current.rowSpan, endRow - current.startRow);
		current.cardCount += 1;
		current.y = Math.max(current.y, endRow + 1);
	}

	return sections.map((section, index) => ({
		...section,
		title: index === 0 ? section.title : `${section.title} ${index + 1}`
	}));
}
