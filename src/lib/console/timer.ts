/**
 * A timer on the console (homeCore's own, and any plugin's): a small clock
 * with the time it has left, counted down each second from when it started
 * (as its card counts it), and Start or Cancel; a paused one offers Resume
 * and Cancel, so the time it has left isn't thrown away.
 *
 * homeCore's timers take `start`, `resume` and `cancel` as commands; a
 * plugin's are pressed by the actions it declares, when it declares them.
 *
 * Pure: the tile draws what this decides.
 */
import { kindOf } from '../card.js';
import type { CoreDevice } from '../devices.js';
import { clock, isHelper, remaining } from '../helpers.js';

/** A press of a timer's button: a homeCore command, or the plugin's action. */
export type TimerLabel = 'Start' | 'Resume' | 'Cancel';
export type TimerPress =
	{ label: TimerLabel; command: Record<string, unknown> } | { label: TimerLabel; action: string };

export interface TimerView {
	running: boolean;
	/** The large figure: the time left ("4:12"), else what it's doing ("idle", "done"). */
	figure: string;
	/** The figure is a word, or a paused time: drawn dimmed. */
	dim: boolean;
	/** Said under the name when the figure doesn't say it: "Paused". */
	note?: string;
	/** Its button, when it has one. */
	press?: TimerPress;
	/** A second button beside it: Cancel, for a paused one. */
	also?: TimerPress;
}

export const isTimer = (d: CoreDevice): boolean => kindOf(d) === 'timer';

const secs = (v: unknown): number | undefined =>
	typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;

/** A homeCore timer's own length to start with: its default, else its last run's, else 5 min. */
const lengthOf = (a: Record<string, unknown>): number =>
	secs(a.default_secs) ?? secs(a.duration_secs) ?? 300;

/** What a timer shows `now` (ms), and what its button does. */
export function timerView(d: CoreDevice, now: number): TimerView {
	const a = d.attributes ?? {};
	const state = typeof a.state === 'string' ? a.state : 'idle';
	const running = state === 'running';
	const left = remaining(a, now) ?? (typeof a.remaining_secs === 'number' ? a.remaining_secs : 0);
	const view: TimerView = running
		? { running, figure: clock(Math.ceil(left)), dim: false }
		: state === 'paused'
			? { running, figure: clock(Math.ceil(left)), dim: true, note: 'Paused' }
			: { running, figure: state === 'finished' ? 'done' : 'idle', dim: true };
	const paused = state === 'paused';
	// Running: Cancel. Paused: Resume, and Cancel beside it. Else: Start.
	const first: TimerLabel = running ? 'Cancel' : paused ? 'Resume' : 'Start';
	const helper = isHelper(d);
	const pressOf = (label: TimerLabel): TimerPress | undefined => {
		const id = label.toLowerCase();
		if (helper)
			return {
				label,
				command: id === 'start' ? { command: 'start', duration_secs: lengthOf(a) } : { command: id }
			};
		const action = d.schema?.actions?.find((x) => x.id === id);
		return action ? { label, action: action.id } : undefined;
	};
	const press = pressOf(first);
	const also = paused ? pressOf('Cancel') : undefined;
	if (press) view.press = press;
	if (also) view.also = also;
	return view;
}
