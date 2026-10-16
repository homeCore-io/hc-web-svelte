/**
 * Customise mode (N6): which page, if any, is being arranged by this person
 * right now. While it is, cards show their tools instead of acting.
 */
class Customise {
	page = $state<string | null>(null);

	on(page: string): boolean {
		return this.page === page;
	}
}

export const customise = new Customise();
