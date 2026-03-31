export type Scene = {
	id: string;
	name: string;
	description?: string | null;
	states?: Record<string, unknown>;
};

export type DisplayScene = {
	id: string;
	name: string;
	description?: string | null;
	states?: Record<string, unknown>;
	isPlugin: boolean;
	lastActivated?: string | null;
};

export function sceneStateCount(scene: Scene): number {
	return Object.keys(scene.states ?? {}).length;
}

export function sceneSummary(scene: Scene): string {
	if (scene.description?.trim()) return scene.description;
	const count = sceneStateCount(scene);
	return count === 1 ? '1 captured device state' : `${count} captured device states`;
}

export function pluginSceneSummary(scene: DisplayScene): string {
	if (!scene.isPlugin) return sceneSummary(scene);
	return scene.description?.trim() || 'Plugin-managed scene device';
}

export function parseScene(input: unknown): Scene {
	const value = input as Record<string, unknown>;
	return {
		id: String(value.id),
		name: (value.name as string | undefined) ?? String(value.id),
		description: (value.description as string | null | undefined) ?? null,
		states: (value.states as Record<string, unknown> | undefined) ?? {}
	};
}
