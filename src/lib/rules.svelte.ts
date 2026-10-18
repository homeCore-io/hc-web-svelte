/**
 * The house's rules, kept current for the pages that only name them — a
 * device's "used by", a helper's or a mode's rules, a channel's senders,
 * search. homeCore says when one changes (`rule_changed`, `rule_removed`);
 * coming back to the tab reads them again, for anything said while away.
 */
import { loadRules, type RuleRef } from './uses.js';
import { live } from './live.svelte.js';

class LiveRules {
	list = $state.raw<RuleRef[]>([]);
	#started = false;

	/** Read them, and keep them current from then on. Safe to call often. */
	start(): void {
		if (this.#started) return;
		this.#started = true;
		void this.load();
		live.listen((frame) => {
			const f = frame as { type: string; rule?: RuleRef; rule_id?: string };
			if (f.type === 'rule_changed' && f.rule) {
				const r = f.rule;
				this.list = this.list.some((x) => x.id === r.id)
					? this.list.map((x) => (x.id === r.id ? r : x))
					: [...this.list, r];
			} else if (f.type === 'rule_removed' && f.rule_id) {
				this.list = this.list.filter((x) => x.id !== f.rule_id);
			}
		});
		if (typeof document !== 'undefined')
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') void this.load();
			});
	}

	async load(): Promise<void> {
		const got = await loadRules();
		if (got) this.list = got;
	}
}

export const liveRules = new LiveRules();
